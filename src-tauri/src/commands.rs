use crate::documents::{Document, OpenDocument};
use std::{path::Path, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct Session {
    pub current: Option<OpenDocument>,
    pub error: Option<String>,
    pub revision: u64,
    pub image_bytes: usize,
}

pub type ReaderState = Mutex<Session>;

pub fn open_selected(app: &AppHandle, path: &Path) -> Result<Document, String> {
    let state = app.state::<ReaderState>();
    let mut session = state
        .lock()
        .map_err(|_| "The reader is busy. Please restart Mivu.")?;
    let next = OpenDocument::selected(path, session.revision + 1)?;
    Ok(publish(app, &mut session, next))
}

fn publish(app: &AppHandle, session: &mut Session, next: OpenDocument) -> Document {
    let snapshot = next.snapshot.clone();
    session.revision = snapshot.id;
    session.current = Some(next);
    session.error = None;
    session.image_bytes = 0;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&format!("{} — Mivu", snapshot.name));
    }
    let _ = app.emit("document-changed", &snapshot);
    snapshot
}

#[tauri::command]
pub async fn open_relative(app: AppHandle, id: u64, reference: String) -> Result<Document, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<ReaderState>();
        let mut session = state.lock().map_err(|_| "The reader is busy.")?;
        let current = session
            .current
            .as_ref()
            .filter(|open| open.snapshot.id == id)
            .ok_or("This document is no longer active.")?;
        let next = current.linked(&reference, session.revision + 1)?;
        Ok(publish(&app, &mut session, next))
    })
    .await
    .map_err(|_| "Could not open the linked document.")?
}

#[tauri::command]
pub async fn read_image(app: AppHandle, id: u64, reference: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<ReaderState>();
        let mut session = state.lock().map_err(|_| "The reader is busy.")?;
        if session.image_bytes >= 24 * 1024 * 1024 {
            return Err("This document's image budget is exhausted.".into());
        }
        let current = session
            .current
            .as_ref()
            .filter(|open| open.snapshot.id == id)
            .ok_or("This document is no longer active.")?;
        let (source, size) = current.image(&reference)?;
        session.image_bytes += size;
        Ok(source)
    })
    .await
    .map_err(|_| "Could not read the image.")?
}

pub fn validate_external(value: &str) -> Result<url::Url, String> {
    let url = url::Url::parse(value).map_err(|_| "This link is not a valid URL.")?;
    if !matches!(url.scheme(), "https" | "http" | "mailto")
        || !url.username().is_empty()
        || url.password().is_some()
        || value.chars().any(char::is_control)
    {
        return Err("Only HTTP, HTTPS, and mail links can be opened externally.".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = validate_external(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Could not open your default browser or mail application.".into())
}

pub fn report_error(app: &AppHandle, message: String) {
    if let Ok(mut session) = app.state::<ReaderState>().lock() {
        session.error = Some(message.clone());
    }
    let _ = app.emit("document-error", message);
}

#[tauri::command]
pub async fn pick_document(app: AppHandle) -> Result<Option<Document>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut picker = app
            .dialog()
            .file()
            .set_title("Open Markdown")
            .add_filter("Markdown", &["md", "markdown", "MD", "MARKDOWN"]);
        if let Some(window) = app.get_webview_window("main") {
            picker = picker.set_parent(&window);
        }
        let selected = picker.blocking_pick_file();
        selected
            .map(|file| {
                let path = file
                    .into_path()
                    .map_err(|_| "The selected file has no local path.")?;
                open_selected(&app, &path)
            })
            .transpose()
    })
    .await
    .map_err(|_| "The file picker could not finish.")?
}

#[derive(serde::Serialize)]
pub struct InitialState {
    document: Option<Document>,
    error: Option<String>,
}

#[tauri::command]
pub fn current_document(state: State<'_, ReaderState>) -> Result<InitialState, String> {
    let session = state
        .lock()
        .map_err(|_| "The reader is busy. Please restart Mivu.")?;
    Ok(InitialState {
        document: session.current.as_ref().map(|open| open.snapshot.clone()),
        error: session.error.clone(),
    })
}

use crate::documents::{Document, OpenDocument};
use std::{path::Path, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct Session {
    pub current: Option<OpenDocument>,
    pub error: Option<String>,
    pub revision: u64,
}

pub type ReaderState = Mutex<Session>;

pub fn open_selected(app: &AppHandle, path: &Path) -> Result<Document, String> {
    let state = app.state::<ReaderState>();
    let mut session = state
        .lock()
        .map_err(|_| "The reader is busy. Please restart Mivu.")?;
    let next = OpenDocument::selected(path, session.revision + 1)?;
    let snapshot = next.snapshot.clone();
    session.revision = snapshot.id;
    session.current = Some(next);
    session.error = None;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&format!("{} — Mivu", snapshot.name));
    }
    let _ = app.emit("document-changed", &snapshot);
    Ok(snapshot)
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

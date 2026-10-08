use crate::documents::{Document, OpenDocument};
use crate::file_watcher::{DocumentWatcher, WatchNotice};
use std::{path::Path, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct Session {
    pub current: Option<OpenDocument>,
    pub error: Option<String>,
    pub revision: u64,
    pub image_bytes: usize,
    pub watcher: Option<DocumentWatcher>,
    pub watch_generation: u64,
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
    session.watcher = None;
    session.watch_generation += 1;
    let generation = session.watch_generation;
    let handle = app.clone();
    let watcher = DocumentWatcher::new(&next.folder.join(&next.relative), move |notice| {
        refresh_from_watch(&handle, generation, notice);
    });
    let snapshot = next.snapshot.clone();
    session.revision = snapshot.id;
    session.current = Some(next);
    session.error = None;
    session.image_bytes = 0;
    let warning = match watcher {
        Ok(watcher) => {
            session.watcher = Some(watcher);
            None
        }
        Err(error) => {
            session.error = Some(error.clone());
            Some(error)
        }
    };
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title(&format!("{} — Mivu", snapshot.name));
    }
    let _ = app.emit("document-changed", &snapshot);
    if let Some(message) = warning {
        emit_error(app, snapshot.id, message);
    }
    snapshot
}

#[derive(Clone, serde::Serialize)]
pub struct DocumentError {
    id: u64,
    message: String,
}

fn emit_error(app: &AppHandle, id: u64, message: String) {
    let _ = app.emit("document-error", DocumentError { id, message });
}

fn refresh_from_watch(app: &AppHandle, generation: u64, notice: WatchNotice) {
    let state = app.state::<ReaderState>();
    let Ok(mut session) = state.lock() else {
        return;
    };
    if generation != session.watch_generation {
        return;
    }
    let result = match notice {
        WatchNotice::Failed => {
            Err("Automatic refresh failed. Reopen the file to restart it.".into())
        }
        WatchNotice::Changed => session
            .current
            .as_ref()
            .ok_or_else(|| "No document is open.".to_owned())
            .and_then(|current| crate::documents::read_markdown(&current.root, &current.relative)),
    };
    match result {
        Ok(content) => {
            let changed = session
                .current
                .as_ref()
                .is_some_and(|current| current.snapshot.content != content);
            if changed || session.error.is_some() {
                session.revision += 1;
                let revision = session.revision;
                session.error = None;
                session.image_bytes = 0;
                if let Some(current) = session.current.as_mut() {
                    current.snapshot.id = revision;
                    current.snapshot.content = content;
                    let _ = app.emit("document-changed", &current.snapshot);
                }
            }
        }
        Err(message) => {
            if session.error.as_ref() != Some(&message) {
                session.error = Some(message.clone());
                emit_error(app, session.revision, message);
            }
        }
    }
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
        if session.image_bytes + size > 24 * 1024 * 1024 {
            return Err("This document's image budget is exhausted.".into());
        }
        session.image_bytes += size;
        Ok(source)
    })
    .await
    .map_err(|_| "Could not read the image.")?
}

#[tauri::command]
pub async fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let url = crate::security::validate_external(&url)?;
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|_| "Could not open your default browser or mail application.".into())
}

pub fn report_error(app: &AppHandle, message: String) {
    if let Ok(mut session) = app.state::<ReaderState>().lock() {
        session.error = Some(message.clone());
        emit_error(app, session.revision, message);
    }
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

mod commands;
mod documents;

use commands::{open_selected, report_error, ReaderState, Session};
use std::sync::Mutex;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Mutex::new(Session::default()) as ReaderState)
        .invoke_handler(tauri::generate_handler![
            commands::pick_document,
            commands::current_document
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                if let Some(path) = paths.first() {
                    let app = window.app_handle().clone();
                    let path = path.clone();
                    tauri::async_runtime::spawn_blocking(move || {
                        if let Err(error) = open_selected(&app, &path) {
                            report_error(&app, error);
                        }
                    });
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Mivu could not start");
}

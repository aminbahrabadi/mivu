mod cli;
mod commands;
mod documents;
mod file_watcher;
mod security;

use commands::{open_selected, report_error, ReaderState, Session};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let app = app.clone();
            tauri::async_runtime::spawn_blocking(move || {
                match cli::document_argument(
                    args.into_iter().map(Into::into),
                    std::path::Path::new(&cwd),
                ) {
                    Ok(Some(path)) => {
                        if let Err(error) = open_selected(&app, &path) {
                            report_error(&app, error);
                        }
                    }
                    Ok(None) => {}
                    Err(error) => report_error(&app, error),
                }
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(Session::default()) as ReaderState)
        .setup(|app| {
            let config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("Missing main window configuration")?;
            tauri::WebviewWindowBuilder::from_config(app, config)?
                .on_navigation(security::allowed_navigation)
                .build()?;
            let handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                match std::env::current_dir()
                    .map_err(|_| "Could not determine the launch directory.".to_owned())
                    .and_then(|cwd| cli::document_argument(std::env::args_os(), &cwd))
                {
                    Ok(Some(path)) => {
                        if let Err(error) = open_selected(&handle, &path) {
                            report_error(&handle, error);
                        }
                    }
                    Ok(None) => {}
                    Err(error) => report_error(&handle, error),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pick_document,
            commands::current_document,
            commands::open_relative,
            commands::read_image,
            commands::open_external
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(event) = event {
                let active = matches!(
                    event,
                    tauri::DragDropEvent::Enter { .. } | tauri::DragDropEvent::Over { .. }
                );
                let _ = window.emit("drag-active", active);
                if let tauri::DragDropEvent::Drop { paths, .. } = event {
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
            }
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Ok(mut session) = window.state::<ReaderState>().lock() {
                    session.watcher = None;
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Mivu could not start");
}

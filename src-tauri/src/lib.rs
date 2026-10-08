pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Mivu could not start");
}

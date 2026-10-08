fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "pick_document",
            "current_document",
            "open_relative",
            "read_image",
            "open_external",
        ]),
    ))
    .expect("could not build the native application manifest");
}

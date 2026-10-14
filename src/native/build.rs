fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["load_local_state", "save_local_state"]),
    )).expect("Unable to build application permissions");
}

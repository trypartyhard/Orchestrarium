mod commands;
mod groups;
mod models;
mod parser;
mod scanner;
mod state;
mod toggler;
mod watcher;

use state::AppState;
use tauri::Manager;

fn make_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
        commands::get_agents,
        commands::get_skills,
        commands::get_commands,
        commands::toggle_item,
        commands::frontend_ready,
    ])
}

pub fn export_bindings() {
    let builder = make_builder();
    builder
        .export(
            specta_typescript::Typescript::new()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");
}

pub fn run() {
    let builder = make_builder();

    #[cfg(debug_assertions)]
    builder
        .export(
            specta_typescript::Typescript::new()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");

    let base_dir = dirs::home_dir()
        .expect("Could not find home directory")
        .join(".claude");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            let app_state = AppState::new(base_dir.clone());
            let watcher_state = app_state.watcher_state.clone();

            app.manage(app_state);

            // Start file watcher
            let app_handle = app.handle().clone();
            let _ = watcher::start_watcher(app_handle, base_dir, watcher_state);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

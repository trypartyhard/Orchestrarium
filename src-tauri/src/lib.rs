mod commands;
mod groups;
mod models;
mod parser;
mod scanner;
pub mod setups;
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
        commands::toggle_batch,
        commands::frontend_ready,
        commands::get_setups,
        commands::get_active_setup,
        commands::clear_active_setup,
        commands::create_setup,
        commands::delete_setup,
        commands::apply_setup,
        commands::export_setup,
        commands::import_setup,
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
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

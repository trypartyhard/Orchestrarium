mod claude_md;
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
        commands::write_setup_file,
        commands::read_setup_file,
        commands::read_item_content,
        commands::auto_import_claude_md,
        commands::list_claude_profiles,
        commands::create_claude_profile,
        commands::activate_claude_profile,
        commands::deactivate_claude_profile,
        commands::delete_claude_profile,
        commands::read_claude_profile,
        commands::save_claude_profile,
        commands::rename_claude_profile,
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

    // Note: bindings are maintained manually in src/bindings.ts
    // Run `cargo test export_bindings` to regenerate if needed

    let base_dir = dirs::home_dir()
        .ok_or("Could not find home directory. Please ensure HOME or USERPROFILE is set.")
        .expect("Fatal: home directory not found")
        .join(".claude");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus existing window when second instance is launched
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
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

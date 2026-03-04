use std::sync::atomic::Ordering;

use tauri::State;

use crate::models::AgentInfo;
use crate::scanner;
use crate::state::AppState;
use crate::toggler;

#[tauri::command]
#[specta::specta]
pub async fn get_agents(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let agents = scanner::scan_section(&state.base_dir, "agents");
    let mut lock = state.agents.lock().await;
    *lock = agents.clone();
    Ok(agents)
}

#[tauri::command]
#[specta::specta]
pub async fn get_skills(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let skills = scanner::scan_section(&state.base_dir, "skills");
    let mut lock = state.skills.lock().await;
    *lock = skills.clone();
    Ok(skills)
}

#[tauri::command]
#[specta::specta]
pub async fn get_commands(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let cmds = scanner::scan_section(&state.base_dir, "commands");
    let mut lock = state.commands.lock().await;
    *lock = cmds.clone();
    Ok(cmds)
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_item(
    state: State<'_, AppState>,
    path: String,
    enable: bool,
    section: String,
) -> Result<AgentInfo, String> {
    // Suppress watcher events during self-initiated toggle
    state.watcher_state.suppressed.store(true, Ordering::SeqCst);

    let file_path = std::path::PathBuf::from(&path);
    let result = toggler::toggle(&file_path, enable);

    // Brief delay then unsuppress, so debounced events from our own move are ignored
    let watcher_state = state.watcher_state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        watcher_state.suppressed.store(false, Ordering::SeqCst);
    });

    let new_path = result?;
    let agent = crate::parser::parse_agent_file(&new_path, &section, enable);

    // Update cached state
    let agents = scanner::scan_section(&state.base_dir, &section);
    match section.as_str() {
        "agents" => *state.agents.lock().await = agents,
        "skills" => *state.skills.lock().await = agents,
        "commands" => *state.commands.lock().await = agents,
        _ => {}
    }

    Ok(agent)
}

/// Frontend signals it's ready to receive watcher events.
#[tauri::command]
#[specta::specta]
pub async fn frontend_ready() -> Result<(), String> {
    Ok(())
}

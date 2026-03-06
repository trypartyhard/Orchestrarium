use std::sync::atomic::Ordering;

use tauri::State;

use crate::models::AgentInfo;
use crate::scanner;
use crate::state::AppState;
use crate::toggler;

/// Determine scope from a file path.
/// Files under the user's home .claude directory are "global", others are "project".
fn detect_scope(path: &str) -> &'static str {
    let normalized = path.replace('\\', "/");
    if let Some(home) = dirs::home_dir() {
        let home_claude = home.join(".claude").to_string_lossy().replace('\\', "/");
        if normalized.starts_with(&home_claude) {
            return "global";
        }
    }
    "project"
}

#[tauri::command]
#[specta::specta]
pub async fn get_agents(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let agents = scanner::scan_section(&state.base_dir, "agents", "global");
    let mut lock = state.agents.lock().await;
    *lock = agents.clone();
    Ok(agents)
}

#[tauri::command]
#[specta::specta]
pub async fn get_skills(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let skills = scanner::scan_section(&state.base_dir, "skills", "global");
    let mut lock = state.skills.lock().await;
    *lock = skills.clone();
    Ok(skills)
}

#[tauri::command]
#[specta::specta]
pub async fn get_commands(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let cmds = scanner::scan_section(&state.base_dir, "commands", "global");
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
    let scope = detect_scope(&new_path.to_string_lossy());
    let agent = crate::parser::parse_agent_file(&new_path, &section, enable, scope);

    // Update cached state
    let agents = scanner::scan_section(&state.base_dir, &section, "global");
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

// ─── Setup commands ──────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn get_setups() -> Result<Vec<crate::setups::Setup>, String> {
    let file = crate::setups::load_setups()?;
    Ok(file.setups)
}

#[tauri::command]
#[specta::specta]
pub async fn get_active_setup() -> Result<Option<String>, String> {
    let file = crate::setups::load_setups()?;
    Ok(file.active)
}

#[tauri::command]
#[specta::specta]
pub async fn create_setup(
    state: State<'_, AppState>,
    name: String,
) -> Result<crate::setups::Setup, String> {
    let agents = state.agents.lock().await.clone();
    let skills = state.skills.lock().await.clone();
    let commands = state.commands.lock().await.clone();

    let entries = crate::setups::snapshot_current(&agents, &skills, &commands);
    let setup = crate::setups::Setup {
        name: name.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
        entries,
    };

    let mut file = crate::setups::load_setups()?;
    // Replace if same name exists
    file.setups.retain(|s| s.name != name);
    file.setups.push(setup.clone());
    file.active = Some(name);
    crate::setups::save_setups(&file)?;

    Ok(setup)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_setup(name: String) -> Result<(), String> {
    let mut file = crate::setups::load_setups()?;
    file.setups.retain(|s| s.name != name);
    if file.active.as_deref() == Some(&name) {
        file.active = None;
    }
    crate::setups::save_setups(&file)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn apply_setup(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<String>, String> {
    let mut file = crate::setups::load_setups()?;
    let setup = file
        .setups
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Setup '{}' not found", name))?
        .clone();

    let failures = crate::setups::apply_setup_entries(&setup.entries, &state.base_dir)?;

    // Mark as active
    file.active = Some(name);
    crate::setups::save_setups(&file)?;

    // Refresh cached state
    let (agents, skills, commands) = scanner::scan_all(&state.base_dir, "global");
    *state.agents.lock().await = agents;
    *state.skills.lock().await = skills;
    *state.commands.lock().await = commands;

    Ok(failures)
}

#[tauri::command]
#[specta::specta]
pub async fn export_setup(name: String) -> Result<String, String> {
    let file = crate::setups::load_setups()?;
    let setup = file
        .setups
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Setup '{}' not found", name))?;
    serde_json::to_string_pretty(setup).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn import_setup(json: String) -> Result<crate::setups::Setup, String> {
    let setup: crate::setups::Setup =
        serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {}", e))?;

    let mut file = crate::setups::load_setups()?;
    // Replace if same name exists
    file.setups.retain(|s| s.name != setup.name);
    file.setups.push(setup.clone());
    crate::setups::save_setups(&file)?;

    Ok(setup)
}

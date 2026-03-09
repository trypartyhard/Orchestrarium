use std::sync::atomic::Ordering;

use tauri::State;

use crate::claude_md;
use crate::models::{AgentInfo, ToggleBatchItem};
use crate::scanner;
use crate::state::AppState;
use crate::toggler;

const WINDOWS_RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL",
    "COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Validate that a file path is inside ~/.claude/
fn validate_path_in_claude_dir(path: &str) -> Result<(), String> {
    let canonical = dunce::canonicalize(path)
        .map_err(|e| format!("Invalid path: {}", e))?;
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let claude_dir = dunce::canonicalize(home.join(".claude"))
        .unwrap_or_else(|_| home.join(".claude"));
    if !canonical.starts_with(&claude_dir) {
        return Err("Access denied: path must be inside ~/.claude/".into());
    }
    Ok(())
}

fn validate_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Name cannot be empty".into());
    }
    if trimmed.chars().count() > 30 {
        return Err("Name is too long (max 30 characters)".into());
    }
    if !trimmed.chars().all(|c| c.is_alphanumeric() || c == ' ' || c == '-' || c == '_') {
        return Err("Only letters, numbers, spaces, hyphens and underscores allowed".into());
    }
    if WINDOWS_RESERVED.iter().any(|r| r.eq_ignore_ascii_case(trimmed)) {
        return Err("This name is reserved by Windows".into());
    }
    Ok(())
}

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
    validate_path_in_claude_dir(&path)?;

    // Suppress watcher events during self-initiated toggle
    state.watcher_state.suppress_count.fetch_add(1, Ordering::SeqCst);

    let file_path = std::path::PathBuf::from(&path);
    let result = toggler::toggle(&file_path, enable);

    // Brief delay then unsuppress, so debounced events from our own move are ignored
    let watcher_state = state.watcher_state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        watcher_state.suppress_count.fetch_sub(1, Ordering::SeqCst);
    });

    let new_path = result?;

    // Update cached state and return the item from the fresh scan
    let agents = scanner::scan_section(&state.base_dir, &section, "global");
    let agent = agents
        .iter()
        .find(|a| a.path == new_path.to_string_lossy().replace('\\', "/"))
        .cloned()
        .unwrap_or_else(|| {
            let scope = detect_scope(&new_path.to_string_lossy());
            crate::parser::parse_agent_file(&new_path, &section, enable, scope)
        });
    match section.as_str() {
        "agents" => *state.agents.lock().await = agents,
        "skills" => *state.skills.lock().await = agents,
        "commands" => *state.commands.lock().await = agents,
        _ => {}
    }

    Ok(agent)
}

/// Toggle multiple items at once (batch operation).
#[tauri::command]
#[specta::specta]
pub async fn toggle_batch(
    state: State<'_, AppState>,
    items: Vec<ToggleBatchItem>,
) -> Result<Vec<String>, String> {
    // Validate all paths before starting
    for item in &items {
        validate_path_in_claude_dir(&item.path)?;
    }

    state.watcher_state.suppress_count.fetch_add(1, Ordering::SeqCst);

    let mut failures: Vec<String> = Vec::new();
    for item in &items {
        let file_path = std::path::PathBuf::from(&item.path);
        if let Err(e) = toggler::toggle(&file_path, item.enable) {
            failures.push(format!("{}: {}", item.path, e));
        }
    }

    // Refresh cached state for all sections
    let (agents, skills, commands) = scanner::scan_all(&state.base_dir, "global");
    *state.agents.lock().await = agents;
    *state.skills.lock().await = skills;
    *state.commands.lock().await = commands;

    let watcher_state = state.watcher_state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        watcher_state.suppress_count.fetch_sub(1, Ordering::SeqCst);
    });

    Ok(failures)
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
pub async fn clear_active_setup() -> Result<(), String> {
    let mut file = crate::setups::load_setups()?;
    file.active = None;
    crate::setups::save_setups(&file)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn create_setup(
    state: State<'_, AppState>,
    name: String,
) -> Result<crate::setups::Setup, String> {
    validate_name(&name)?;
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
    state.watcher_state.suppress_count.fetch_add(1, Ordering::SeqCst);

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

    let watcher_state = state.watcher_state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        watcher_state.suppress_count.fetch_sub(1, Ordering::SeqCst);
    });

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
    if json.len() > 1_000_000 {
        return Err("Import data too large (max 1MB)".into());
    }
    let setup: crate::setups::Setup =
        serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {}", e))?;
    validate_name(&setup.name)?;
    if setup.entries.len() > 10_000 {
        return Err("Too many entries in setup (max 10,000)".into());
    }

    let mut file = crate::setups::load_setups()?;
    // Replace if same name exists
    file.setups.retain(|s| s.name != setup.name);
    file.setups.push(setup.clone());
    crate::setups::save_setups(&file)?;

    Ok(setup)
}

// ─── File preview ───────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn read_item_content(path: String) -> Result<String, String> {
    validate_path_in_claude_dir(&path)?;
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

// ─── CLAUDE.md profile commands ─────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn auto_import_claude_md() -> Result<bool, String> {
    claude_md::auto_import_if_needed()
}

#[tauri::command]
#[specta::specta]
pub async fn list_claude_profiles() -> Result<Vec<claude_md::ClaudeMdProfile>, String> {
    claude_md::list_profiles()
}

#[tauri::command]
#[specta::specta]
pub async fn create_claude_profile(name: String, from_current: bool) -> Result<(), String> {
    validate_name(&name)?;
    claude_md::create_profile(&name, from_current)
}

#[tauri::command]
#[specta::specta]
pub async fn activate_claude_profile(name: String) -> Result<(), String> {
    validate_name(&name)?;
    claude_md::activate_profile(&name)
}

#[tauri::command]
#[specta::specta]
pub async fn deactivate_claude_profile() -> Result<(), String> {
    claude_md::deactivate_profile()
}

#[tauri::command]
#[specta::specta]
pub async fn delete_claude_profile(name: String) -> Result<(), String> {
    validate_name(&name)?;
    claude_md::delete_profile(&name)
}

#[tauri::command]
#[specta::specta]
pub async fn read_claude_profile(name: String) -> Result<String, String> {
    validate_name(&name)?;
    claude_md::read_profile(&name)
}

#[tauri::command]
#[specta::specta]
pub async fn save_claude_profile(name: String, content: String) -> Result<(), String> {
    validate_name(&name)?;
    claude_md::save_profile(&name, &content)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_claude_profile(old_name: String, new_name: String) -> Result<(), String> {
    validate_name(&old_name)?;
    validate_name(&new_name)?;
    claude_md::rename_profile(&old_name, &new_name)
}

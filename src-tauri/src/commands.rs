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

/// Validate that a file path is inside allowed roots.
/// Read access: allows both ~/.claude and <project>/.claude (if project set).
/// Mutation access: use validate_path_for_mutation instead.
async fn validate_path_in_allowed_roots(state: &State<'_, AppState>, path: &str) -> Result<(), String> {
    let canonical = dunce::canonicalize(path)
        .map_err(|e| format!("Invalid path: {}", e))?;

    // Always allow ~/.claude
    let global_canonical = dunce::canonicalize(&state.global_dir)
        .unwrap_or_else(|_| state.global_dir.clone());
    if canonical.starts_with(&global_canonical) {
        return Ok(());
    }

    // Allow <project>/.claude if project is set
    let proj = state.project_dir.lock().await;
    if let Some(ref project_root) = *proj {
        let project_claude = project_root.join(".claude");
        if let Ok(proj_canonical) = dunce::canonicalize(&project_claude) {
            if canonical.starts_with(&proj_canonical) {
                return Ok(());
            }
        }
    }

    Err("Access denied: path must be inside an allowed .claude/ directory".into())
}

/// Validate that a path is inside the currently active context directory.
async fn validate_path_for_mutation(state: &State<'_, AppState>, path: &str) -> Result<(), String> {
    let canonical = dunce::canonicalize(path)
        .map_err(|e| format!("Invalid path: {}", e))?;

    let active_dir = state.active_claude_dir().await?;
    let active_canonical = dunce::canonicalize(&active_dir)
        .unwrap_or_else(|_| active_dir);

    if canonical.starts_with(&active_canonical) {
        return Ok(());
    }

    Err("Access denied: path must be inside the active context directory".into())
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

// ─── Context commands ───────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn set_active_context(
    state: State<'_, AppState>,
    context: String,
) -> Result<(), String> {
    if context != "global" && context != "project" {
        return Err("Context must be 'global' or 'project'".into());
    }
    let mut ctx = state.active_context.lock().await;
    *ctx = context.clone();
    drop(ctx);

    // Reconfigure project watcher based on new context
    let tx = state.watcher_state.project_watcher_tx.lock().await;
    if let Some(ref sender) = *tx {
        if context == "project" {
            let proj = state.project_dir.lock().await;
            if let Some(ref dir) = *proj {
                let _ = sender.send(Some(dir.clone()));
            }
        } else {
            let _ = sender.send(None);
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_active_context(state: State<'_, AppState>) -> Result<String, String> {
    let ctx = state.active_context.lock().await;
    Ok(ctx.clone())
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_dir(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<(), String> {
    let mut proj = state.project_dir.lock().await;
    match path {
        Some(p) => {
            let project_root = std::path::PathBuf::from(&p);
            if !project_root.exists() {
                return Err(format!("Path does not exist: {}", p));
            }
            // Ensure .claude/ and its subdirectories exist
            let claude_dir = project_root.join(".claude");
            for section in &["agents", "skills", "commands"] {
                std::fs::create_dir_all(claude_dir.join(section))
                    .map_err(|e| format!("Failed to create {}: {}", section, e))?;
            }
            let root_clone = project_root.clone();
            *proj = Some(project_root);
            drop(proj); // release lock before sending

            // Reconfigure project watcher
            let tx = state.watcher_state.project_watcher_tx.lock().await;
            if let Some(ref sender) = *tx {
                let _ = sender.send(Some(root_clone));
            }
        }
        None => {
            *proj = None;
            drop(proj);

            // Stop project watcher
            let tx = state.watcher_state.project_watcher_tx.lock().await;
            if let Some(ref sender) = *tx {
                let _ = sender.send(None);
            }
        }
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_project_dir(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let proj = state.project_dir.lock().await;
    Ok(proj.as_ref().map(|p| p.to_string_lossy().to_string()))
}

// ─── Scan commands ──────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn get_agents(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;
    let agents = scanner::scan_section(&base, "agents", scope);
    let mut lock = state.agents.lock().await;
    *lock = agents.clone();
    Ok(agents)
}

#[tauri::command]
#[specta::specta]
pub async fn get_skills(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;
    let skills = scanner::scan_section(&base, "skills", scope);
    let mut lock = state.skills.lock().await;
    *lock = skills.clone();
    Ok(skills)
}

#[tauri::command]
#[specta::specta]
pub async fn get_commands(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;
    let cmds = scanner::scan_section(&base, "commands", scope);
    let mut lock = state.commands.lock().await;
    *lock = cmds.clone();
    Ok(cmds)
}

// ─── Toggle commands ────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn toggle_item(
    state: State<'_, AppState>,
    path: String,
    enable: bool,
    section: String,
) -> Result<AgentInfo, String> {
    validate_path_for_mutation(&state, &path).await?;

    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;

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
    let agents = scanner::scan_section(&base, &section, scope);
    let agent = agents
        .iter()
        .find(|a| a.path == new_path.to_string_lossy().replace('\\', "/"))
        .cloned()
        .unwrap_or_else(|| {
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
        validate_path_for_mutation(&state, &item.path).await?;
    }

    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;

    state.watcher_state.suppress_count.fetch_add(1, Ordering::SeqCst);

    let mut failures: Vec<String> = Vec::new();
    for item in &items {
        let file_path = std::path::PathBuf::from(&item.path);
        if let Err(e) = toggler::toggle(&file_path, item.enable) {
            failures.push(format!("{}: {}", item.path, e));
        }
    }

    // Refresh cached state for all sections
    let (agents, skills, commands) = scanner::scan_all(&base, scope);
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
pub async fn get_setups(state: State<'_, AppState>) -> Result<Vec<crate::setups::Setup>, String> {
    let base = state.active_claude_dir().await?;
    let file = crate::setups::load_setups_from(&base)?;
    Ok(file.setups)
}

#[tauri::command]
#[specta::specta]
pub async fn get_active_setup(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let base = state.active_claude_dir().await?;
    let file = crate::setups::load_setups_from(&base)?;
    Ok(file.active)
}

#[tauri::command]
#[specta::specta]
pub async fn clear_active_setup(state: State<'_, AppState>) -> Result<(), String> {
    let base = state.active_claude_dir().await?;
    let mut file = crate::setups::load_setups_from(&base)?;
    file.active = None;
    crate::setups::save_setups_to(&base, &file)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn create_setup(
    state: State<'_, AppState>,
    name: String,
) -> Result<crate::setups::Setup, String> {
    validate_name(&name)?;
    let base = state.active_claude_dir().await?;

    let agents = state.agents.lock().await.clone();
    let skills = state.skills.lock().await.clone();
    let commands = state.commands.lock().await.clone();

    let entries = crate::setups::snapshot_current(&agents, &skills, &commands);
    let setup = crate::setups::Setup {
        name: name.clone(),
        created_at: chrono::Utc::now().to_rfc3339(),
        entries,
    };

    let mut file = crate::setups::load_setups_from(&base)?;
    // Replace if same name exists
    file.setups.retain(|s| s.name != name);
    file.setups.push(setup.clone());
    file.active = Some(name);
    crate::setups::save_setups_to(&base, &file)?;

    Ok(setup)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_setup(state: State<'_, AppState>, name: String) -> Result<(), String> {
    let base = state.active_claude_dir().await?;
    let mut file = crate::setups::load_setups_from(&base)?;
    file.setups.retain(|s| s.name != name);
    if file.active.as_deref() == Some(&name) {
        file.active = None;
    }
    crate::setups::save_setups_to(&base, &file)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn apply_setup(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<String>, String> {
    state.watcher_state.suppress_count.fetch_add(1, Ordering::SeqCst);

    let result = apply_setup_inner(&state, &name).await;

    // Always schedule unsuppress, even on error
    let watcher_state = state.watcher_state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        watcher_state.suppress_count.fetch_sub(1, Ordering::SeqCst);
    });

    result
}

async fn apply_setup_inner(
    state: &State<'_, AppState>,
    name: &str,
) -> Result<Vec<String>, String> {
    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;

    let mut file = crate::setups::load_setups_from(&base)?;
    let setup = file
        .setups
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Setup '{}' not found", name))?
        .clone();

    let failures = crate::setups::apply_setup_entries(&setup.entries, &base, scope)?;

    // Mark as active
    file.active = Some(name.to_string());
    crate::setups::save_setups_to(&base, &file)?;

    // Refresh cached state
    let (agents, skills, commands) = scanner::scan_all(&base, scope);
    *state.agents.lock().await = agents;
    *state.skills.lock().await = skills;
    *state.commands.lock().await = commands;

    Ok(failures)
}

#[tauri::command]
#[specta::specta]
pub async fn export_setup(state: State<'_, AppState>, name: String) -> Result<String, String> {
    let base = state.active_claude_dir().await?;
    let file = crate::setups::load_setups_from(&base)?;
    let setup = file
        .setups
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Setup '{}' not found", name))?;
    serde_json::to_string_pretty(setup).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn import_setup(state: State<'_, AppState>, json: String) -> Result<crate::setups::Setup, String> {
    if json.len() > 1_000_000 {
        return Err("Import data too large (max 1MB)".into());
    }
    let setup: crate::setups::Setup =
        serde_json::from_str(&json).map_err(|e| format!("Invalid JSON: {}", e))?;
    validate_name(&setup.name)?;
    if setup.entries.len() > 10_000 {
        return Err("Too many entries in setup (max 10,000)".into());
    }

    let base = state.active_claude_dir().await?;
    let mut file = crate::setups::load_setups_from(&base)?;
    // Replace if same name exists
    file.setups.retain(|s| s.name != setup.name);
    file.setups.push(setup.clone());
    crate::setups::save_setups_to(&base, &file)?;

    Ok(setup)
}

// ─── Setup file I/O (for dialog-selected paths outside FS scope) ─

#[tauri::command]
#[specta::specta]
pub async fn write_setup_file(path: String, content: String) -> Result<(), String> {
    if !path.ends_with(".json") {
        return Err("Only .json files are allowed".into());
    }
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
#[specta::specta]
pub async fn read_setup_file(path: String) -> Result<String, String> {
    if !path.ends_with(".json") {
        return Err("Only .json files are allowed".into());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    if content.len() > 1_000_000 {
        return Err("File too large (max 1MB)".into());
    }
    Ok(content)
}

// ─── File preview ───────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn read_item_content(state: State<'_, AppState>, path: String) -> Result<String, String> {
    validate_path_in_allowed_roots(&state, &path).await?;
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
pub async fn list_claude_profiles(state: State<'_, AppState>) -> Result<Vec<claude_md::ClaudeMdProfile>, String> {
    let orch_dir = state.active_orchestrarium_dir().await?;
    claude_md::list_profiles_in(&orch_dir)
}

#[tauri::command]
#[specta::specta]
pub async fn create_claude_profile(state: State<'_, AppState>, name: String, from_current: bool) -> Result<(), String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::create_profile_in(&orch_dir, &claude_md, &name, from_current)
}

#[tauri::command]
#[specta::specta]
pub async fn activate_claude_profile(state: State<'_, AppState>, name: String) -> Result<(), String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::activate_profile_in(&orch_dir, &claude_md, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn deactivate_claude_profile(state: State<'_, AppState>) -> Result<(), String> {
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::deactivate_profile_in(&orch_dir, &claude_md)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_claude_profile(state: State<'_, AppState>, name: String) -> Result<(), String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::delete_profile_in(&orch_dir, &claude_md, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn read_claude_profile(state: State<'_, AppState>, name: String) -> Result<String, String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    claude_md::read_profile_in(&orch_dir, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn save_claude_profile(state: State<'_, AppState>, name: String, content: String) -> Result<(), String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::save_profile_in(&orch_dir, &claude_md, &name, &content)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_claude_profile(state: State<'_, AppState>, old_name: String, new_name: String) -> Result<(), String> {
    validate_name(&old_name)?;
    validate_name(&new_name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    claude_md::rename_profile_in(&orch_dir, &old_name, &new_name)
}

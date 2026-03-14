use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::claude_md;
use crate::models::{AgentInfo, ToggleBatchItem};
use crate::scanner;
use crate::state::AppState;
use crate::toggler;

const WINDOWS_RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
    "COM8", "COM9", "LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Validate that a file path is inside allowed roots.
/// Read access: allows both ~/.claude and <project>/.claude (if project set).
/// Mutation access: use validate_path_for_mutation instead.
async fn validate_path_in_allowed_roots(
    state: &State<'_, AppState>,
    path: &str,
) -> Result<(), String> {
    let canonical = dunce::canonicalize(path).map_err(|e| format!("Invalid path: {}", e))?;

    // Always allow ~/.claude
    let global_canonical =
        dunce::canonicalize(&state.global_dir).unwrap_or_else(|_| state.global_dir.clone());
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

/// Resolve and validate a toggle path against the active .claude directory.
/// Only top-level files are supported:
/// - `{section}/file.md`
/// - `{section}/.disabled/file.md`
fn resolve_toggle_path(
    path: &str,
    expected_section: Option<&str>,
    active_claude_dir: &std::path::Path,
) -> Result<(std::path::PathBuf, String), String> {
    let p = std::path::Path::new(path);
    if p.extension().and_then(|e| e.to_str()) != Some("md") {
        return Err("Only .md files can be toggled".into());
    }

    let canonical = dunce::canonicalize(p).map_err(|e| format!("Invalid path: {}", e))?;
    let canonical_root =
        dunce::canonicalize(active_claude_dir).unwrap_or_else(|_| active_claude_dir.to_path_buf());

    if !canonical.starts_with(&canonical_root) {
        return Err("Access denied: path must be inside the active .claude directory".into());
    }

    let relative = canonical
        .strip_prefix(&canonical_root)
        .map_err(|_| "Path is not inside active directory")?;
    let parts: Vec<String> = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect();

    let (section, file_name) = match parts.as_slice() {
        [section, file_name] => (section.as_str(), file_name.as_str()),
        [section, disabled, file_name] if disabled == ".disabled" => {
            (section.as_str(), file_name.as_str())
        }
        _ => {
            return Err(
                "File must be a top-level entry inside section/ or section/.disabled/".into(),
            )
        }
    };

    validate_section(section)?;
    if std::path::Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        != Some("md")
    {
        return Err("Only .md files can be toggled".into());
    }

    if let Some(expected_section) = expected_section {
        if section != expected_section {
            return Err(format!(
                "Path does not match section '{}'",
                expected_section
            ));
        }
    }

    Ok((canonical, section.to_string()))
}

fn validate_section(section: &str) -> Result<(), String> {
    if !["agents", "skills", "commands"].contains(&section) {
        return Err("Invalid section: must be agents, skills, or commands".into());
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
    if !trimmed
        .chars()
        .all(|c| c.is_alphanumeric() || c == ' ' || c == '-' || c == '_')
    {
        return Err("Only letters, numbers, spaces, hyphens and underscores allowed".into());
    }
    if WINDOWS_RESERVED
        .iter()
        .any(|r| r.eq_ignore_ascii_case(trimmed))
    {
        return Err("This name is reserved by Windows".into());
    }
    Ok(())
}

// ─── Context commands ───────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn set_active_context(state: State<'_, AppState>, context: String) -> Result<(), String> {
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
            let raw_root = std::path::PathBuf::from(&p);
            if !raw_root.exists() {
                return Err(format!("Path does not exist: {}", p));
            }
            let project_root = dunce::canonicalize(&raw_root)
                .map_err(|e| format!("Failed to resolve path: {}", e))?;
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

/// In project context, scan project items first, then append global items
/// that don't already exist in the project (by filename).
async fn scan_section_merged(
    state: &State<'_, AppState>,
    section: &str,
) -> Result<Vec<AgentInfo>, String> {
    let ctx = state.active_context.lock().await.clone();
    let base = state.active_claude_dir().await?;
    let scope = if ctx == "project" {
        "project"
    } else {
        "global"
    };

    let mut items = scanner::scan_section(&base, section, scope);

    // In project context, also include global items not already present
    if ctx == "project" {
        let project_filenames: std::collections::HashSet<String> =
            items.iter().map(|i| i.filename.clone()).collect();
        let global_items = scanner::scan_section(&state.global_dir, section, "global");
        for item in global_items {
            if !project_filenames.contains(&item.filename) {
                items.push(item);
            }
        }
        // Reassign groups after merging so grouping reflects the full combined list
        crate::groups::assign_groups(&mut items);
        // Sort by filename for stable ordering (prevents items jumping after copy-to-project)
        items.sort_by(|a, b| a.filename.cmp(&b.filename));
    }

    Ok(items)
}

#[tauri::command]
#[specta::specta]
pub async fn get_agents(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let agents = scan_section_merged(&state, "agents").await?;
    let mut lock = state.agents.lock().await;
    *lock = agents.clone();
    Ok(agents)
}

#[tauri::command]
#[specta::specta]
pub async fn get_skills(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let skills = scan_section_merged(&state, "skills").await?;
    let mut lock = state.skills.lock().await;
    *lock = skills.clone();
    Ok(skills)
}

#[tauri::command]
#[specta::specta]
pub async fn get_commands(state: State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let cmds = scan_section_merged(&state, "commands").await?;
    let mut lock = state.commands.lock().await;
    *lock = cmds.clone();
    Ok(cmds)
}

/// Copy a global item (.md file) into the project's .claude/{section}/ directory.
/// Returns the new AgentInfo after copy.
#[tauri::command]
#[specta::specta]
pub async fn copy_item_to_project(
    state: State<'_, AppState>,
    source_path: String,
    section: String,
) -> Result<AgentInfo, String> {
    validate_section(&section)?;
    // Validate source is in global dir
    let source = std::path::PathBuf::from(&source_path);
    let global_canonical =
        dunce::canonicalize(&state.global_dir).unwrap_or_else(|_| state.global_dir.clone());
    let source_canonical =
        dunce::canonicalize(&source).map_err(|e| format!("Invalid path: {}", e))?;
    if !source_canonical.starts_with(&global_canonical) {
        return Err("Source must be a global item".into());
    }

    // Get project dir
    let project_claude = state.active_claude_dir().await?;
    let ctx = state.active_context.lock().await.clone();
    if ctx != "project" {
        return Err("Must be in project context".into());
    }

    let filename = source.file_name().ok_or("No filename")?;
    let target_dir = project_claude.join(&section);
    std::fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create dir: {}", e))?;

    let target = target_dir.join(filename);
    if target.exists() {
        return Err(format!(
            "Item already exists in project: {}",
            filename.to_string_lossy()
        ));
    }

    std::fs::copy(&source, &target).map_err(|e| format!("Failed to copy: {}", e))?;

    // Parse and return the new item
    let agent = crate::parser::parse_agent_file(&target, &section, true, "project");
    Ok(agent)
}

// ─── Toggle commands ────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn toggle_item(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
    enable: bool,
    section: String,
) -> Result<AgentInfo, String> {
    validate_section(&section)?;
    let base = state.active_claude_dir().await?;
    let (canonical_path, resolved_section) = resolve_toggle_path(&path, Some(&section), &base)?;
    let scope = state.active_scope().await;
    let locked_paths = state
        .acquire_toggle_paths(std::slice::from_ref(&canonical_path))
        .await?;

    // Suppress watcher events during self-initiated toggle
    state.begin_suppression().await;

    let result = toggler::toggle(&canonical_path, enable);

    // Brief delay then unsuppress, flush pending if needed
    let watcher_state = state.watcher_state.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        crate::state::unsuppress_and_flush(&watcher_state, &app_clone).await;
    });

    state.release_toggle_paths(&locked_paths).await;

    let new_path = result?;

    // Update cached state and return the item from the fresh scan
    let agents = scanner::scan_section(&base, &resolved_section, scope);
    let agent = agents
        .iter()
        .find(|a| a.path == new_path.to_string_lossy().replace('\\', "/"))
        .cloned()
        .unwrap_or_else(|| {
            crate::parser::parse_agent_file(&new_path, &resolved_section, enable, scope)
        });
    match resolved_section.as_str() {
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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    items: Vec<ToggleBatchItem>,
) -> Result<Vec<String>, String> {
    let base = state.active_claude_dir().await?;

    let mut canonical_paths = Vec::with_capacity(items.len());

    // Validate all paths before starting using the active .claude root
    for item in &items {
        let (canonical, _) = resolve_toggle_path(&item.path, None, &base)?;
        canonical_paths.push(canonical);
    }
    let scope = state.active_scope().await;
    let locked_paths = state.acquire_toggle_paths(&canonical_paths).await?;

    state.begin_suppression().await;

    let mut failures: Vec<String> = Vec::new();
    for (item, file_path) in items.iter().zip(canonical_paths.iter()) {
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
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        crate::state::unsuppress_and_flush(&watcher_state, &app_clone).await;
    });
    state.release_toggle_paths(&locked_paths).await;

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
    let _lock = state.setups_lock.lock().await;
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
    item_ids: Vec<String>,
) -> Result<crate::setups::Setup, String> {
    validate_name(&name)?;
    let _lock = state.setups_lock.lock().await;
    let base = state.active_claude_dir().await?;

    let agents = state.agents.lock().await.clone();
    let skills = state.skills.lock().await.clone();
    let commands = state.commands.lock().await.clone();

    let all_entries = crate::setups::snapshot_current(&agents, &skills, &commands);
    // Only include items that are in the provided setupIds
    let id_set: std::collections::HashSet<&str> = item_ids.iter().map(|s| s.as_str()).collect();
    let entries: Vec<_> = all_entries
        .into_iter()
        .filter(|e| id_set.contains(e.id.as_str()))
        .collect();
    if entries.len() != item_ids.len() {
        let entry_ids: std::collections::HashSet<&str> =
            entries.iter().map(|e| e.id.as_str()).collect();
        let missing_ids: Vec<String> = item_ids
            .into_iter()
            .filter(|id| !entry_ids.contains(id.as_str()))
            .collect();
        return Err(format!(
            "Cannot create setup; missing item IDs: {}",
            missing_ids.join(", ")
        ));
    }
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
    let _lock = state.setups_lock.lock().await;
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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<String>, String> {
    state.begin_suppression().await;

    let result = apply_setup_inner(&state, &name).await;

    // Always schedule unsuppress, even on error
    let watcher_state = state.watcher_state.clone();
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        crate::state::unsuppress_and_flush(&watcher_state, &app_clone).await;
    });

    result
}

async fn apply_setup_inner(state: &State<'_, AppState>, name: &str) -> Result<Vec<String>, String> {
    let _lock = state.setups_lock.lock().await;
    let base = state.active_claude_dir().await?;
    let scope = state.active_scope().await;

    let mut file = crate::setups::load_setups_from(&base)?;
    let setup = file
        .setups
        .iter()
        .find(|s| s.name == name)
        .ok_or_else(|| format!("Setup '{}' not found", name))?
        .clone();

    let failures =
        crate::setups::apply_setup_entries(state.inner(), &setup.entries, &base, scope).await?;

    // Only mark as active if there were no failures (bug #6)
    if failures.is_empty() {
        file.active = Some(name.to_string());
        crate::setups::save_setups_to(&base, &file)?;
    }

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
pub async fn import_setup(
    state: State<'_, AppState>,
    json: String,
) -> Result<crate::setups::Setup, String> {
    let _lock = state.setups_lock.lock().await;
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

// ─── Setup file I/O (backend-owned native dialogs) ─

fn dialog_path_to_pathbuf(
    path: tauri_plugin_dialog::FilePath,
) -> Result<std::path::PathBuf, String> {
    path.into_path()
        .map_err(|e| format!("Invalid dialog path: {}", e))
}

fn ensure_json_extension(mut path: std::path::PathBuf) -> std::path::PathBuf {
    let has_json_extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("json"))
        .unwrap_or(false);

    if !has_json_extension {
        path.set_extension("json");
    }

    path
}

#[tauri::command]
#[specta::specta]
pub async fn save_setup_file_with_dialog(
    app: tauri::AppHandle,
    suggested_name: String,
    content: String,
) -> Result<bool, String> {
    let default_name = if suggested_name.trim().is_empty() {
        "setup.json".to_string()
    } else {
        suggested_name
    };

    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name(default_name)
        .blocking_save_file()
    else {
        return Ok(false);
    };

    let path = ensure_json_extension(dialog_path_to_pathbuf(file_path)?);
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(true)
}

#[tauri::command]
#[specta::specta]
pub async fn read_setup_file_with_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let path = dialog_path_to_pathbuf(file_path)?;
    let is_json = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    if !is_json {
        return Err("Only .json files are allowed".into());
    }

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    if content.len() > 1_000_000 {
        return Err("File too large (max 1MB)".into());
    }

    Ok(Some(content))
}

// ─── File preview ───────────────────────────────────────────────

#[tauri::command]
#[specta::specta]
pub async fn read_item_content(state: State<'_, AppState>, path: String) -> Result<String, String> {
    validate_path_in_allowed_roots(&state, &path).await?;
    // Only allow reading .md files for preview
    let p = std::path::Path::new(&path);
    if p.extension().and_then(|e| e.to_str()) != Some("md") {
        return Err("Only .md files can be previewed".into());
    }
    let meta = std::fs::metadata(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    if meta.len() > 1_000_000 {
        return Err("File too large to preview (max 1MB)".into());
    }
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
pub async fn list_claude_profiles(
    state: State<'_, AppState>,
) -> Result<Vec<claude_md::ClaudeMdProfile>, String> {
    let orch_dir = state.active_orchestrarium_dir().await?;
    claude_md::list_profiles_in(&orch_dir)
}

#[tauri::command]
#[specta::specta]
pub async fn create_claude_profile(
    state: State<'_, AppState>,
    name: String,
    from_current: bool,
) -> Result<(), String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::create_profile_in(&orch_dir, &claude_md, &name, from_current)
}

#[tauri::command]
#[specta::specta]
pub async fn activate_claude_profile(
    state: State<'_, AppState>,
    name: String,
) -> Result<(), String> {
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
pub async fn read_claude_profile(
    state: State<'_, AppState>,
    name: String,
) -> Result<String, String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    claude_md::read_profile_in(&orch_dir, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn save_claude_profile(
    state: State<'_, AppState>,
    name: String,
    content: String,
) -> Result<(), String> {
    validate_name(&name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    let claude_md = state.active_claude_md_path().await?;
    claude_md::save_profile_in(&orch_dir, &claude_md, &name, &content)
}

#[tauri::command]
#[specta::specta]
pub async fn rename_claude_profile(
    state: State<'_, AppState>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    validate_name(&old_name)?;
    validate_name(&new_name)?;
    let orch_dir = state.active_orchestrarium_dir().await?;
    claude_md::rename_profile_in(&orch_dir, &old_name, &new_name)
}

#[cfg(test)]
mod tests {
    use super::resolve_toggle_path;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_resolve_toggle_path_rejects_section_mismatch() {
        let tmp = TempDir::new().unwrap();
        let agents_dir = tmp.path().join("agents");
        fs::create_dir_all(&agents_dir).unwrap();
        let file = agents_dir.join("agent.md");
        fs::write(&file, "---\nname: Agent\n---\n").unwrap();

        let err = resolve_toggle_path(file.to_string_lossy().as_ref(), Some("skills"), tmp.path())
            .unwrap_err();
        assert!(err.contains("Path does not match section"));
    }

    #[test]
    fn test_resolve_toggle_path_rejects_nested_files() {
        let tmp = TempDir::new().unwrap();
        let nested_dir = tmp.path().join("agents").join("nested");
        fs::create_dir_all(&nested_dir).unwrap();
        let file = nested_dir.join("agent.md");
        fs::write(&file, "---\nname: Agent\n---\n").unwrap();

        let err = resolve_toggle_path(file.to_string_lossy().as_ref(), Some("agents"), tmp.path())
            .unwrap_err();
        assert!(err.contains("top-level entry"));
    }
}

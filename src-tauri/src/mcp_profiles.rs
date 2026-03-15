use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::mcp::McpServerType;
use crate::state::AppState;

const MANAGED_STATE_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProfileScope {
    Global,
    Project,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum McpProfileHealth {
    Ok,
    Drift,
    Conflict,
    Broken,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum McpProfileIssueKind {
    Drift,
    Conflict,
    Broken,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpProfileIssue {
    pub kind: McpProfileIssueKind,
    pub message: String,
    pub blocking: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct McpProfileSummary {
    pub name: String,
    pub active: bool,
    pub server_count: usize,
    pub health_status: McpProfileHealth,
    pub server_types: Vec<McpServerType>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct McpProfileDetail {
    pub name: String,
    pub active: bool,
    pub server_count: usize,
    pub health_status: McpProfileHealth,
    pub server_types: Vec<McpServerType>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct McpProfileActivationPreview {
    pub profile_name: String,
    pub server_count: usize,
    pub can_activate: bool,
    pub collisions: Vec<String>,
    pub issues: Vec<McpProfileIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredMcpProfile {
    name: String,
    #[serde(default)]
    servers: BTreeMap<String, Value>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StoredMcpProfileSnapshot {
    name: String,
    #[serde(default)]
    servers: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ManagedStateFile {
    #[serde(default = "managed_state_version")]
    version: u32,
    #[serde(default)]
    active_profile: Option<String>,
    #[serde(default)]
    owned_servers: Vec<String>,
    #[serde(default)]
    applied_profile_snapshot: Option<StoredMcpProfileSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawProjectMcpFile {
    #[serde(default)]
    mcp_servers: BTreeMap<String, Value>,
    #[serde(skip)]
    wrapper: bool,
    #[serde(skip)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawClaudeConfigFile {
    #[serde(default)]
    mcp_servers: BTreeMap<String, Value>,
    #[serde(default)]
    projects: BTreeMap<String, Value>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

struct StateSnapshot {
    active_name: Option<String>,
    managed_state: Option<ManagedStateFile>,
    live_servers: BTreeMap<String, Value>,
    issues: Vec<McpProfileIssue>,
}

#[tauri::command]
#[specta::specta]
pub async fn list_mcp_profiles(
    state: State<'_, AppState>,
) -> Result<Vec<McpProfileSummary>, String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    list_profiles_in(&orchestrarium_dir, scope, &live_config_path)
}

#[tauri::command]
#[specta::specta]
pub async fn read_mcp_profile(
    state: State<'_, AppState>,
    name: String,
) -> Result<McpProfileDetail, String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    validate_profile_name(&name)?;
    read_profile_in(&orchestrarium_dir, scope, &live_config_path, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn create_mcp_profile(
    state: State<'_, AppState>,
    name: String,
) -> Result<McpProfileDetail, String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    validate_profile_name(&name)?;
    let _lock = state.mcp_lock.lock().await;
    create_profile_in(&orchestrarium_dir, &name)?;
    read_profile_in(&orchestrarium_dir, scope, &live_config_path, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn save_mcp_profile(
    state: State<'_, AppState>,
    name: String,
    content: String,
) -> Result<McpProfileDetail, String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    validate_profile_name(&name)?;
    let _lock = state.mcp_lock.lock().await;
    save_profile_in(&orchestrarium_dir, &name, &content)?;
    read_profile_in(&orchestrarium_dir, scope, &live_config_path, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_mcp_profile(state: State<'_, AppState>, name: String) -> Result<(), String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    validate_profile_name(&name)?;
    let _lock = state.mcp_lock.lock().await;
    delete_profile_in(&orchestrarium_dir, scope, &live_config_path, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn preview_activate_mcp_profile(
    state: State<'_, AppState>,
    name: String,
) -> Result<McpProfileActivationPreview, String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    validate_profile_name(&name)?;
    preview_activate_profile_in(&orchestrarium_dir, scope, &live_config_path, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn activate_mcp_profile(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    name: String,
) -> Result<(), String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    validate_profile_name(&name)?;
    state.begin_suppression().await;
    schedule_unsuppress(&app, state.watcher_state.clone());
    let _lock = state.mcp_lock.lock().await;
    activate_profile_in(&orchestrarium_dir, scope, &live_config_path, &name)
}

#[tauri::command]
#[specta::specta]
pub async fn deactivate_mcp_profile(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (scope, orchestrarium_dir, live_config_path) = active_profile_paths(&state).await?;
    state.begin_suppression().await;
    schedule_unsuppress(&app, state.watcher_state.clone());
    let _lock = state.mcp_lock.lock().await;
    deactivate_profile_in(&orchestrarium_dir, scope, &live_config_path)
}

fn list_profiles_in(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
) -> Result<Vec<McpProfileSummary>, String> {
    let profiles_dir = profiles_dir_for(orchestrarium_dir);
    if !profiles_dir.exists() {
        return Ok(Vec::new());
    }

    let snapshot = load_state_snapshot(orchestrarium_dir, scope, live_config_path)?;

    let mut profiles = Vec::new();
    for entry in fs::read_dir(&profiles_dir).map_err(|e| format!("Read dir error: {}", e))? {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        if !is_profile_path(&path) {
            continue;
        }

        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("")
            .to_string();
        let active = snapshot.active_name.as_deref() == Some(name.as_str());
        let profile_text = read_optional_text(&path)?;

        match parse_profile_text(&profile_text, &path, Some(&name)) {
            Ok(profile) => {
                let collisions = derive_collisions(
                    &profile,
                    &snapshot.live_servers,
                    snapshot.managed_state.as_ref(),
                );
                let health_status = derive_profile_health(
                    &name,
                    collisions.as_slice(),
                    snapshot.issues.as_slice(),
                    snapshot.active_name.as_deref(),
                    snapshot.managed_state.as_ref(),
                );
                profiles.push(McpProfileSummary {
                    name,
                    active,
                    server_count: profile.servers.len(),
                    health_status,
                    server_types: collect_server_types(profile.servers.values()),
                });
            }
            Err(_) => {
                profiles.push(McpProfileSummary {
                    name,
                    active,
                    server_count: 0,
                    health_status: McpProfileHealth::Broken,
                    server_types: Vec::new(),
                });
            }
        }
    }

    profiles.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(profiles)
}

fn read_profile_in(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
    name: &str,
) -> Result<McpProfileDetail, String> {
    let summaries = list_profiles_in(orchestrarium_dir, scope, live_config_path)?;
    let summary = summaries
        .into_iter()
        .find(|profile| profile.name == name)
        .ok_or_else(|| format!("MCP profile '{}' not found", name))?;
    let path = profile_path_for(orchestrarium_dir, name);
    let text = read_optional_text(&path)?;
    let profile = parse_profile_text(&text, &path, Some(name))?;

    Ok(McpProfileDetail {
        name: name.to_string(),
        active: summary.active,
        server_count: profile.servers.len(),
        health_status: summary.health_status,
        server_types: collect_server_types(profile.servers.values()),
        content: serialize_profile(&profile, &path)?,
    })
}

pub fn create_profile_in(orchestrarium_dir: &Path, name: &str) -> Result<(), String> {
    let name = validate_profile_name(name)?;
    let path = profile_path_for(orchestrarium_dir, &name);
    if path.exists() {
        return Err(format!("MCP profile '{}' already exists", name));
    }

    let content = serialize_profile(
        &StoredMcpProfile {
            name: name.clone(),
            servers: BTreeMap::new(),
            extra: BTreeMap::new(),
        },
        &path,
    )?;
    atomic_write(&path, &content)
}

pub fn save_profile_in(orchestrarium_dir: &Path, name: &str, content: &str) -> Result<(), String> {
    let name = validate_profile_name(name)?;
    let path = profile_path_for(orchestrarium_dir, &name);
    let profile = normalize_profile_for_save(name, content, &path)?;
    let serialized = serialize_profile(&profile, &path)?;
    atomic_write(&path, &serialized)
}

fn delete_profile_in(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
    name: &str,
) -> Result<(), String> {
    let name = validate_profile_name(name)?;
    let path = profile_path_for(orchestrarium_dir, &name);
    if !path.exists() {
        return Err(format!("MCP profile '{}' not found", name));
    }

    let snapshot = load_state_snapshot(orchestrarium_dir, scope, live_config_path)?;

    if !snapshot.issues.is_empty() {
        return Err(
            "Managed MCP profile state is inconsistent; resolve drift before deleting profiles"
                .into(),
        );
    }

    if snapshot.active_name.as_deref() == Some(name.as_str())
        || snapshot
            .managed_state
            .as_ref()
            .and_then(|state| state.active_profile.as_deref())
            == Some(name.as_str())
    {
        return Err("Deactivate the active MCP profile before deleting it".into());
    }

    fs::remove_file(&path).map_err(|e| format!("Delete error: {}", e))
}

fn preview_activate_profile_in(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
    name: &str,
) -> Result<McpProfileActivationPreview, String> {
    let name = validate_profile_name(name)?;
    let path = profile_path_for(orchestrarium_dir, &name);
    if !path.exists() {
        return Err(format!("MCP profile '{}' not found", name));
    }

    let text = read_optional_text(&path)?;
    let profile = parse_profile_text(&text, &path, Some(&name))?;
    let snapshot = load_state_snapshot(orchestrarium_dir, scope, live_config_path)?;
    let mut issues = snapshot.issues;
    let collisions = derive_collisions(
        &profile,
        &snapshot.live_servers,
        snapshot.managed_state.as_ref(),
    );
    if !collisions.is_empty() {
        issues.push(McpProfileIssue {
            kind: McpProfileIssueKind::Conflict,
            message: format!(
                "Profile '{}' collides with manual live servers: {}",
                name,
                collisions.join(", ")
            ),
            blocking: true,
        });
    }

    Ok(McpProfileActivationPreview {
        profile_name: name,
        server_count: profile.servers.len(),
        can_activate: collisions.is_empty() && issues.iter().all(|issue| !issue.blocking),
        collisions,
        issues,
    })
}

fn activate_profile_in(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
    name: &str,
) -> Result<(), String> {
    let preview = preview_activate_profile_in(orchestrarium_dir, scope, live_config_path, name)?;
    if !preview.can_activate {
        return Err(format_activation_failure(&preview));
    }

    let path = profile_path_for(orchestrarium_dir, name);
    let profile = parse_profile_text(&read_optional_text(&path)?, &path, Some(name))?;
    let previous_active_name = read_active_name_for(orchestrarium_dir)?;
    let previous_managed_state = read_managed_state_optional_for(orchestrarium_dir)?;
    let previous_live_servers = read_live_servers(scope, live_config_path)?;
    let owned_servers = sorted_server_names(profile.servers.keys());
    let normalized_servers = normalize_live_server_configs(&profile.servers)?;
    let snapshot = StoredMcpProfileSnapshot {
        name: profile.name.clone(),
        servers: normalized_servers.clone(),
    };
    let old_owned = previous_managed_state
        .as_ref()
        .map(|state| state.owned_servers.clone())
        .unwrap_or_default();

    mutate_live_servers_with_retry(scope, live_config_path, |live_servers| {
        for server_name in &old_owned {
            live_servers.remove(server_name);
        }
        for (server_name, config) in &normalized_servers {
            live_servers.insert(server_name.clone(), config.clone());
        }
        Ok(())
    })?;

    let metadata_result = (|| -> Result<(), String> {
        write_managed_state_for(
            orchestrarium_dir,
            &ManagedStateFile {
                version: MANAGED_STATE_VERSION,
                active_profile: Some(profile.name.clone()),
                owned_servers,
                applied_profile_snapshot: Some(snapshot),
            },
        )?;
        write_active_name_for(orchestrarium_dir, &profile.name)?;
        Ok(())
    })();

    if let Err(error) = metadata_result {
        let live_restore_error =
            replace_live_servers_with_retry(scope, live_config_path, &previous_live_servers).err();
        let metadata_restore_error = restore_profile_metadata(
            orchestrarium_dir,
            previous_active_name.as_deref(),
            previous_managed_state.as_ref(),
        )
        .err();
        return Err(format_recovery_failure(
            "Failed to finalize MCP profile activation",
            &error,
            live_restore_error,
            metadata_restore_error,
        ));
    }

    Ok(())
}

fn deactivate_profile_in(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
) -> Result<(), String> {
    let active_name = read_active_name_for(orchestrarium_dir)?;
    let managed_state = read_managed_state_optional_for(orchestrarium_dir)?;
    let state = match managed_state {
        Some(state) if !state.owned_servers.is_empty() => state,
        Some(_) => {
            clear_active_name_for(orchestrarium_dir)?;
            clear_managed_state_for(orchestrarium_dir)?;
            return Ok(());
        }
        None if active_name.is_none() => return Ok(()),
        None => {
            return Err("Cannot safely deactivate MCP profile: managed state is missing".into());
        }
    };

    let previous_live_servers = read_live_servers(scope, live_config_path)?;
    let previous_active_name = active_name.clone();
    let previous_managed_state = Some(state.clone());
    let owned_servers = state.owned_servers.clone();
    mutate_live_servers_with_retry(scope, live_config_path, |live_servers| {
        for server_name in &owned_servers {
            live_servers.remove(server_name);
        }
        Ok(())
    })?;

    let metadata_result = (|| -> Result<(), String> {
        clear_active_name_for(orchestrarium_dir)?;
        clear_managed_state_for(orchestrarium_dir)?;
        Ok(())
    })();

    if let Err(error) = metadata_result {
        let live_restore_error =
            replace_live_servers_with_retry(scope, live_config_path, &previous_live_servers).err();
        let metadata_restore_error = restore_profile_metadata(
            orchestrarium_dir,
            previous_active_name.as_deref(),
            previous_managed_state.as_ref(),
        )
        .err();
        return Err(format_recovery_failure(
            "Failed to finalize MCP profile deactivation",
            &error,
            live_restore_error,
            metadata_restore_error,
        ));
    }

    Ok(())
}

fn managed_state_version() -> u32 {
    MANAGED_STATE_VERSION
}

fn profiles_dir_for(orchestrarium_dir: &Path) -> PathBuf {
    orchestrarium_dir.join("mcp-profiles")
}

fn profile_path_for(orchestrarium_dir: &Path, name: &str) -> PathBuf {
    profiles_dir_for(orchestrarium_dir).join(format!("{}.json", name))
}

fn active_profile_path_for(orchestrarium_dir: &Path) -> PathBuf {
    profiles_dir_for(orchestrarium_dir).join(".active")
}

fn managed_state_path_for(orchestrarium_dir: &Path) -> PathBuf {
    profiles_dir_for(orchestrarium_dir).join(".managed-state.json")
}

fn profile_path_in_dir(profiles_dir: &Path, name: &str) -> PathBuf {
    profiles_dir.join(format!("{}.json", name))
}

fn is_profile_path(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()) == Some("json")
        && path
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| !name.starts_with('.'))
            .unwrap_or(false)
}

fn read_active_name_for(orchestrarium_dir: &Path) -> Result<Option<String>, String> {
    let path = active_profile_path_for(orchestrarium_dir);
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read active MCP profile marker: {}", e))?;
    Ok(match content.trim() {
        "" => None,
        value => Some(value.to_string()),
    })
}

fn write_active_name_for(orchestrarium_dir: &Path, name: &str) -> Result<(), String> {
    atomic_write(&active_profile_path_for(orchestrarium_dir), name.trim())
}

fn clear_active_name_for(orchestrarium_dir: &Path) -> Result<(), String> {
    let path = active_profile_path_for(orchestrarium_dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to clear active MCP profile: {}", e))?;
    }
    Ok(())
}

fn read_managed_state_optional_for(
    orchestrarium_dir: &Path,
) -> Result<Option<ManagedStateFile>, String> {
    let path = managed_state_path_for(orchestrarium_dir);
    let content = read_optional_text(&path)?;
    if content.trim().is_empty() {
        return Ok(None);
    }

    let mut state: ManagedStateFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;
    state.owned_servers = dedupe_sorted_strings(state.owned_servers);
    Ok(Some(state))
}

#[cfg(test)]
fn read_managed_state_for(orchestrarium_dir: &Path) -> Result<ManagedStateFile, String> {
    read_managed_state_optional_for(orchestrarium_dir)?
        .ok_or_else(|| "Managed state is missing".into())
}

fn write_managed_state_for(
    orchestrarium_dir: &Path,
    state: &ManagedStateFile,
) -> Result<(), String> {
    let path = managed_state_path_for(orchestrarium_dir);
    let mut normalized = state.clone();
    normalized.version = MANAGED_STATE_VERSION;
    normalized.owned_servers = dedupe_sorted_strings(normalized.owned_servers);
    let serialized = serde_json::to_string_pretty(&normalized)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?;
    atomic_write(&path, &serialized)
}

fn clear_managed_state_for(orchestrarium_dir: &Path) -> Result<(), String> {
    let path = managed_state_path_for(orchestrarium_dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to clear managed MCP state: {}", e))?;
    }
    Ok(())
}

fn write_managed_state_optional_for(
    orchestrarium_dir: &Path,
    state: Option<&ManagedStateFile>,
) -> Result<(), String> {
    match state {
        Some(state) => write_managed_state_for(orchestrarium_dir, state),
        None => clear_managed_state_for(orchestrarium_dir),
    }
}

fn write_active_name_optional_for(
    orchestrarium_dir: &Path,
    name: Option<&str>,
) -> Result<(), String> {
    match name {
        Some(name) => write_active_name_for(orchestrarium_dir, name),
        None => clear_active_name_for(orchestrarium_dir),
    }
}

fn restore_profile_metadata(
    orchestrarium_dir: &Path,
    active_name: Option<&str>,
    managed_state: Option<&ManagedStateFile>,
) -> Result<(), String> {
    write_managed_state_optional_for(orchestrarium_dir, managed_state)?;
    write_active_name_optional_for(orchestrarium_dir, active_name)?;
    Ok(())
}

fn normalize_profile_for_save(
    name: String,
    content: &str,
    path: &Path,
) -> Result<StoredMcpProfile, String> {
    let mut profile = parse_profile_text(content, path, Some(&name))?;
    profile.name = name;
    Ok(profile)
}

fn parse_profile_text(
    content: &str,
    path: &Path,
    expected_name: Option<&str>,
) -> Result<StoredMcpProfile, String> {
    let mut profile: StoredMcpProfile = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;

    if let Some(name) = expected_name {
        profile.name = validate_profile_name(name)?;
    } else {
        profile.name = validate_profile_name(&profile.name)?;
    }

    for (server_name, config) in &profile.servers {
        validate_server_name(server_name)?;
        validate_live_server_config(server_name, config, path)?;
    }

    Ok(profile)
}

fn serialize_profile(profile: &StoredMcpProfile, path: &Path) -> Result<String, String> {
    serde_json::to_string_pretty(profile)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))
}

fn read_live_servers(
    scope: ProfileScope,
    live_config_path: &Path,
) -> Result<BTreeMap<String, Value>, String> {
    match scope {
        ProfileScope::Global => Ok(read_claude_config_file(live_config_path)?.mcp_servers),
        ProfileScope::Project => Ok(read_project_mcp_file(live_config_path)?.mcp_servers),
    }
}

fn load_state_snapshot(
    orchestrarium_dir: &Path,
    scope: ProfileScope,
    live_config_path: &Path,
) -> Result<StateSnapshot, String> {
    let profiles_dir = profiles_dir_for(orchestrarium_dir);
    let active_name = read_active_name_for(orchestrarium_dir)?;
    let mut issues = Vec::new();

    let managed_state = match read_managed_state_optional_for(orchestrarium_dir) {
        Ok(state) => state,
        Err(error) => {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: error,
                blocking: true,
            });
            None
        }
    };

    let live_servers = match read_live_servers(scope, live_config_path) {
        Ok(servers) => servers,
        Err(error) => {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: error,
                blocking: true,
            });
            BTreeMap::new()
        }
    };

    issues.extend(derive_state_issues(
        &profiles_dir,
        active_name.as_deref(),
        managed_state.as_ref(),
        &live_servers,
    ));

    Ok(StateSnapshot {
        active_name,
        managed_state,
        live_servers,
        issues,
    })
}

fn derive_state_issues(
    profiles_dir: &Path,
    active_name: Option<&str>,
    managed_state: Option<&ManagedStateFile>,
    live_servers: &BTreeMap<String, Value>,
) -> Vec<McpProfileIssue> {
    let mut issues = Vec::new();

    match (active_name, managed_state) {
        (None, None) => {}
        (Some(active), None) => issues.push(McpProfileIssue {
            kind: McpProfileIssueKind::Drift,
            message: format!(
                "Active profile marker points to '{}' but managed state is missing",
                active
            ),
            blocking: true,
        }),
        (None, Some(state)) => {
            if state.active_profile.is_some() || !state.owned_servers.is_empty() {
                issues.push(McpProfileIssue {
                    kind: McpProfileIssueKind::Drift,
                    message: "Managed state exists without an active profile marker".into(),
                    blocking: true,
                });
            }
        }
        (Some(active), Some(state)) => match state.active_profile.as_deref() {
            Some(managed_active) if managed_active == active => {}
            Some(managed_active) => issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Drift,
                message: format!(
                    "Active profile marker '{}' does not match managed state '{}'",
                    active, managed_active
                ),
                blocking: true,
            }),
            None => issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Drift,
                message: "Managed state is missing activeProfile".into(),
                blocking: true,
            }),
        },
    }

    if let Some(active) = active_name {
        if !profile_path_in_dir(profiles_dir, active).exists() {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: format!("Active profile '{}' does not exist on disk", active),
                blocking: true,
            });
        }
    }

    if let Some(state) = managed_state {
        if state.version != MANAGED_STATE_VERSION {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: format!("Unsupported managed state version {}", state.version),
                blocking: true,
            });
        }

        if state.active_profile.is_none() && !state.owned_servers.is_empty() {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: "Managed state has ownedServers but no activeProfile".into(),
                blocking: true,
            });
        }

        if has_duplicates(&state.owned_servers) {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: "Managed state contains duplicate ownedServers".into(),
                blocking: true,
            });
        }

        if !state.owned_servers.is_empty() && state.applied_profile_snapshot.is_none() {
            issues.push(McpProfileIssue {
                kind: McpProfileIssueKind::Broken,
                message: "Managed state is missing appliedProfileSnapshot".into(),
                blocking: true,
            });
        }

        if let Some(snapshot) = &state.applied_profile_snapshot {
            if state.active_profile.as_deref() != Some(snapshot.name.as_str()) {
                issues.push(McpProfileIssue {
                    kind: McpProfileIssueKind::Drift,
                    message: "Managed state snapshot does not match activeProfile".into(),
                    blocking: true,
                });
            }

            for server_name in &state.owned_servers {
                if !snapshot.servers.contains_key(server_name) {
                    issues.push(McpProfileIssue {
                        kind: McpProfileIssueKind::Broken,
                        message: format!(
                            "Managed state snapshot is missing owned server '{}'",
                            server_name
                        ),
                        blocking: true,
                    });
                    continue;
                }

                match live_servers.get(server_name) {
                    Some(live_value) if snapshot.servers.get(server_name) == Some(live_value) => {}
                    Some(_) => issues.push(McpProfileIssue {
                        kind: McpProfileIssueKind::Drift,
                        message: format!(
                            "Owned live server '{}' was edited after activation",
                            server_name
                        ),
                        blocking: false,
                    }),
                    None => issues.push(McpProfileIssue {
                        kind: McpProfileIssueKind::Drift,
                        message: format!(
                            "Owned live server '{}' is missing from the live MCP config",
                            server_name
                        ),
                        blocking: false,
                    }),
                }
            }
        }
    }

    issues
}

fn derive_collisions(
    profile: &StoredMcpProfile,
    live_servers: &BTreeMap<String, Value>,
    managed_state: Option<&ManagedStateFile>,
) -> Vec<String> {
    let owned_servers = managed_state
        .map(|state| state.owned_servers.iter().cloned().collect::<BTreeSet<_>>())
        .unwrap_or_default();

    let manual_servers = live_servers
        .keys()
        .filter(|name| !owned_servers.contains(*name))
        .cloned()
        .collect::<BTreeSet<_>>();

    profile
        .servers
        .keys()
        .filter(|name| manual_servers.contains(*name))
        .cloned()
        .collect()
}

fn derive_profile_health(
    profile_name: &str,
    collisions: &[String],
    state_issues: &[McpProfileIssue],
    active_name: Option<&str>,
    managed_state: Option<&ManagedStateFile>,
) -> McpProfileHealth {
    if !collisions.is_empty() {
        return McpProfileHealth::Conflict;
    }

    let state_related = active_name == Some(profile_name)
        || managed_state.and_then(|state| state.active_profile.as_deref()) == Some(profile_name);
    if !state_related {
        return McpProfileHealth::Ok;
    }

    if state_issues
        .iter()
        .any(|issue| issue.kind == McpProfileIssueKind::Broken)
    {
        return McpProfileHealth::Broken;
    }

    if !state_issues.is_empty() {
        return McpProfileHealth::Drift;
    }

    McpProfileHealth::Ok
}

fn collect_server_types<'a, I>(servers: I) -> Vec<McpServerType>
where
    I: IntoIterator<Item = &'a Value>,
{
    let mut has_command = false;
    let mut has_http = false;
    let mut has_sse = false;

    for server in servers {
        match infer_server_type(server) {
            McpServerType::Command => has_command = true,
            McpServerType::Http => has_http = true,
            McpServerType::Sse => has_sse = true,
        }
    }

    let mut result = Vec::new();
    if has_command {
        result.push(McpServerType::Command);
    }
    if has_http {
        result.push(McpServerType::Http);
    }
    if has_sse {
        result.push(McpServerType::Sse);
    }
    result
}

fn infer_server_type(config: &Value) -> McpServerType {
    let object = match config.as_object() {
        Some(object) => object,
        None => return McpServerType::Command,
    };

    match object.get("type").and_then(|value| value.as_str()) {
        Some("http") => McpServerType::Http,
        Some("sse") => McpServerType::Sse,
        Some("stdio") => McpServerType::Command,
        Some("command") => McpServerType::Command,
        _ if object.contains_key("command") => McpServerType::Command,
        _ if object.contains_key("url") => McpServerType::Http,
        _ => McpServerType::Command,
    }
}

fn normalize_live_server_configs(
    servers: &BTreeMap<String, Value>,
) -> Result<BTreeMap<String, Value>, String> {
    let mut normalized = BTreeMap::new();
    for (server_name, config) in servers {
        normalized.insert(server_name.clone(), normalize_live_server_config(config)?);
    }
    Ok(normalized)
}

fn normalize_live_server_config(config: &Value) -> Result<Value, String> {
    let mut normalized = config.clone();
    let object = normalized
        .as_object_mut()
        .ok_or_else(|| "MCP server config must be a JSON object".to_string())?;

    let explicit_type = object.get("type").and_then(|value| value.as_str());
    let is_stdio = matches!(explicit_type, Some("stdio") | Some("command"))
        || (explicit_type.is_none() && object.contains_key("command"));

    if is_stdio {
        object.insert("type".to_string(), Value::String("stdio".into()));
        object
            .entry("env".to_string())
            .or_insert_with(|| Value::Object(serde_json::Map::new()));
    }

    Ok(normalized)
}

fn sorted_server_names<'a, I>(names: I) -> Vec<String>
where
    I: IntoIterator<Item = &'a String>,
{
    let mut names = names.into_iter().cloned().collect::<Vec<_>>();
    names.sort();
    names
}

fn validate_profile_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("MCP profile name is required".into());
    }
    if trimmed.starts_with('.') {
        return Err("MCP profile name cannot start with '.'".into());
    }
    if trimmed.contains("::") {
        return Err("MCP profile name cannot contain '::'".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("MCP profile name cannot contain path separators".into());
    }
    if trimmed.contains("..") {
        return Err("MCP profile name cannot contain '..'".into());
    }
    Ok(trimmed.to_string())
}

fn validate_server_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("MCP server name is required".into());
    }
    if trimmed.contains("::") {
        return Err("MCP server name cannot contain '::'".into());
    }
    Ok(())
}

fn format_activation_failure(preview: &McpProfileActivationPreview) -> String {
    let mut parts = Vec::new();
    if !preview.collisions.is_empty() {
        parts.push(format!(
            "Name collisions: {}",
            preview.collisions.join(", ")
        ));
    }
    for issue in &preview.issues {
        if issue.blocking {
            parts.push(issue.message.clone());
        }
    }
    if parts.is_empty() {
        parts.push("Activation preflight failed".into());
    }
    parts.join("; ")
}

fn claude_json_path_for_global_dir(global_dir: &Path) -> Result<PathBuf, String> {
    let home = global_dir
        .parent()
        .ok_or("Failed to resolve home directory for .claude.json")?;
    Ok(home.join(".claude.json"))
}

fn read_claude_config_file(path: &Path) -> Result<RawClaudeConfigFile, String> {
    let content = read_optional_text(path)?;
    parse_claude_config_file_text(&content, path)
}

fn parse_claude_config_file_text(
    content: &str,
    path: &Path,
) -> Result<RawClaudeConfigFile, String> {
    if content.trim().is_empty() {
        return Ok(RawClaudeConfigFile::default());
    }

    serde_json::from_str(content).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn serialize_claude_config_file(file: &RawClaudeConfigFile, path: &Path) -> Result<String, String> {
    serde_json::to_string_pretty(file)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))
}

fn mutate_claude_config_file_with_retry<F>(path: &Path, mut mutator: F) -> Result<(), String>
where
    F: FnMut(&mut RawClaudeConfigFile) -> Result<(), String>,
{
    for attempt in 0..2 {
        let original_content = read_optional_text(path)?;
        let mut config = parse_claude_config_file_text(&original_content, path)?;
        mutator(&mut config)?;

        let serialized = serialize_claude_config_file(&config, path)?;
        let current_content = read_optional_text(path)?;
        if current_content != original_content {
            if attempt == 0 {
                continue;
            }
            return Err(format!(
                "{} changed during MCP update; please retry",
                path.display()
            ));
        }

        atomic_write(path, &serialized)?;
        return Ok(());
    }

    Err(format!("Failed to update {}", path.display()))
}

fn project_mcp_json_path(project_root: &Path) -> PathBuf {
    project_root.join(".mcp.json")
}

fn read_project_mcp_file(path: &Path) -> Result<RawProjectMcpFile, String> {
    let content = read_optional_text(path)?;
    parse_project_mcp_file_text(&content, path)
}

fn parse_project_mcp_file_text(content: &str, path: &Path) -> Result<RawProjectMcpFile, String> {
    if content.trim().is_empty() {
        return Ok(RawProjectMcpFile::default());
    }

    let value: Value = serde_json::from_str(content)
        .map_err(|e| format!("Failed to parse {}: {}", path.display(), e))?;
    let object = value
        .as_object()
        .ok_or_else(|| format!("{} must contain a JSON object", path.display()))?;

    if let Some(server_value) = object.get("mcpServers") {
        if !server_value.is_object() {
            return Err(format!(
                "{}: mcpServers must be a JSON object",
                path.display()
            ));
        }

        let mut extra = BTreeMap::new();
        for (key, value) in object {
            if key != "mcpServers" {
                extra.insert(key.clone(), value.clone());
            }
        }

        return Ok(RawProjectMcpFile {
            mcp_servers: serde_json::from_value(server_value.clone()).map_err(|e| {
                format!("Failed to parse MCP servers from {}: {}", path.display(), e)
            })?,
            wrapper: true,
            extra,
        });
    }

    Ok(RawProjectMcpFile {
        mcp_servers: serde_json::from_value(value)
            .map_err(|e| format!("Failed to parse MCP servers from {}: {}", path.display(), e))?,
        wrapper: false,
        extra: BTreeMap::new(),
    })
}

fn serialize_project_mcp_file(file: &RawProjectMcpFile, path: &Path) -> Result<String, String> {
    let value = if file.wrapper {
        let mut map = serde_json::Map::new();
        for (key, value) in &file.extra {
            map.insert(key.clone(), value.clone());
        }
        map.insert(
            "mcpServers".to_string(),
            serde_json::to_value(&file.mcp_servers)
                .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?,
        );
        Value::Object(map)
    } else {
        serde_json::to_value(&file.mcp_servers)
            .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?
    };

    serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))
}

fn mutate_project_mcp_file_with_retry<F>(path: &Path, mut mutator: F) -> Result<(), String>
where
    F: FnMut(&mut RawProjectMcpFile) -> Result<(), String>,
{
    for attempt in 0..2 {
        let original_content = read_optional_text(path)?;
        let mut file = parse_project_mcp_file_text(&original_content, path)?;
        mutator(&mut file)?;

        let serialized = serialize_project_mcp_file(&file, path)?;
        let current_content = read_optional_text(path)?;
        if current_content != original_content {
            if attempt == 0 {
                continue;
            }
            return Err(format!(
                "{} changed during MCP update; please retry",
                path.display()
            ));
        }

        atomic_write(path, &serialized)?;
        return Ok(());
    }

    Err(format!("Failed to update {}", path.display()))
}

fn mutate_live_servers_with_retry<F>(
    scope: ProfileScope,
    live_config_path: &Path,
    mut mutator: F,
) -> Result<(), String>
where
    F: FnMut(&mut BTreeMap<String, Value>) -> Result<(), String>,
{
    match scope {
        ProfileScope::Global => mutate_claude_config_file_with_retry(live_config_path, |config| {
            mutator(&mut config.mcp_servers)
        }),
        ProfileScope::Project => mutate_project_mcp_file_with_retry(live_config_path, |file| {
            mutator(&mut file.mcp_servers)
        }),
    }
}

fn replace_live_servers_with_retry(
    scope: ProfileScope,
    live_config_path: &Path,
    live_servers: &BTreeMap<String, Value>,
) -> Result<(), String> {
    let replacement = live_servers.clone();
    mutate_live_servers_with_retry(scope, live_config_path, move |current_live_servers| {
        *current_live_servers = replacement.clone();
        Ok(())
    })
}

fn format_recovery_failure(
    action: &str,
    error: &str,
    live_restore_error: Option<String>,
    metadata_restore_error: Option<String>,
) -> String {
    let mut message = format!("{}: {}", action, error);
    if let Some(live_restore_error) = live_restore_error {
        message.push_str(&format!(
            "; live MCP rollback failed: {}",
            live_restore_error
        ));
    }
    if let Some(metadata_restore_error) = metadata_restore_error {
        message.push_str(&format!(
            "; profile metadata rollback failed: {}",
            metadata_restore_error
        ));
    }
    message
}

fn read_optional_text(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Invalid path: no parent for {}", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create {}: {}", parent.display(), e))?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("Failed to create temp file in {}: {}", parent.display(), e))?;
    temp.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write temp file for {}: {}", path.display(), e))?;
    temp.persist(path)
        .map_err(|e| format!("Failed to persist {}: {}", path.display(), e.error))?;
    Ok(())
}

fn validate_live_server_config(
    server_name: &str,
    config: &Value,
    path: &Path,
) -> Result<(), String> {
    let object = config.as_object().ok_or_else(|| {
        format!(
            "Server '{}' in {} must be a JSON object",
            server_name,
            path.display()
        )
    })?;

    let explicit_type = match object.get("type") {
        Some(Value::String(value)) => Some(value.as_str()),
        Some(_) => {
            return Err(format!(
                "Server '{}' in {} field 'type' must be a string",
                server_name,
                path.display()
            ))
        }
        None => None,
    };

    let command = read_required_string_field(object, "command", server_name, path, false)?;
    let url = read_required_string_field(object, "url", server_name, path, false)?;

    validate_optional_string_array(object, "args", server_name, path)?;
    validate_optional_string_map(object, "env", server_name, path)?;
    validate_optional_string_map(object, "headers", server_name, path)?;

    match explicit_type {
        Some("command") | Some("stdio") => {
            ensure_field_present(command.as_deref(), "command", server_name, path)?;
            ensure_fields_absent(object, &["url", "headers"], server_name, path)?;
        }
        Some("http") | Some("sse") => {
            ensure_field_present(url.as_deref(), "url", server_name, path)?;
            ensure_fields_absent(object, &["command", "args", "env"], server_name, path)?;
        }
        Some(other) => {
            return Err(format!(
                "Server '{}' in {} has unsupported type '{}'",
                server_name,
                path.display(),
                other
            ))
        }
        None if command.is_some() => {
            ensure_fields_absent(object, &["url", "headers"], server_name, path)?;
        }
        None if url.is_some() => {
            ensure_fields_absent(object, &["command", "args", "env"], server_name, path)?;
        }
        None => {
            return Err(format!(
                "Server '{}' in {} must define either a command or a url",
                server_name,
                path.display()
            ))
        }
    }

    Ok(())
}

fn read_required_string_field(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    server_name: &str,
    path: &Path,
    required: bool,
) -> Result<Option<String>, String> {
    match object.get(field_name) {
        Some(Value::String(value)) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return Err(format!(
                    "Server '{}' in {} field '{}' cannot be empty",
                    server_name,
                    path.display(),
                    field_name
                ));
            }
            Ok(Some(trimmed.to_string()))
        }
        Some(_) => Err(format!(
            "Server '{}' in {} field '{}' must be a string",
            server_name,
            path.display(),
            field_name
        )),
        None if required => Err(format!(
            "Server '{}' in {} requires field '{}'",
            server_name,
            path.display(),
            field_name
        )),
        None => Ok(None),
    }
}

fn validate_optional_string_array(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    server_name: &str,
    path: &Path,
) -> Result<(), String> {
    let Some(value) = object.get(field_name) else {
        return Ok(());
    };

    let items = value.as_array().ok_or_else(|| {
        format!(
            "Server '{}' in {} field '{}' must be an array of strings",
            server_name,
            path.display(),
            field_name
        )
    })?;

    for item in items {
        if !matches!(item, Value::String(_)) {
            return Err(format!(
                "Server '{}' in {} field '{}' must contain only strings",
                server_name,
                path.display(),
                field_name
            ));
        }
    }

    Ok(())
}

fn validate_optional_string_map(
    object: &serde_json::Map<String, Value>,
    field_name: &str,
    server_name: &str,
    path: &Path,
) -> Result<(), String> {
    let Some(value) = object.get(field_name) else {
        return Ok(());
    };

    let entries = value.as_object().ok_or_else(|| {
        format!(
            "Server '{}' in {} field '{}' must be an object of strings",
            server_name,
            path.display(),
            field_name
        )
    })?;

    for (entry_name, entry_value) in entries {
        if !matches!(entry_value, Value::String(_)) {
            return Err(format!(
                "Server '{}' in {} field '{}.{}' must be a string",
                server_name,
                path.display(),
                field_name,
                entry_name
            ));
        }
    }

    Ok(())
}

fn ensure_field_present(
    value: Option<&str>,
    field_name: &str,
    server_name: &str,
    path: &Path,
) -> Result<(), String> {
    if value.is_some() {
        return Ok(());
    }

    Err(format!(
        "Server '{}' in {} requires field '{}'",
        server_name,
        path.display(),
        field_name
    ))
}

fn ensure_fields_absent(
    object: &serde_json::Map<String, Value>,
    field_names: &[&str],
    server_name: &str,
    path: &Path,
) -> Result<(), String> {
    for field_name in field_names {
        if object.contains_key(*field_name) {
            return Err(format!(
                "Server '{}' in {} cannot define field '{}' for this MCP server type",
                server_name,
                path.display(),
                field_name
            ));
        }
    }

    Ok(())
}

fn has_duplicates(values: &[String]) -> bool {
    let mut unique = BTreeSet::new();
    for value in values {
        if !unique.insert(value) {
            return true;
        }
    }
    false
}

fn dedupe_sorted_strings(values: Vec<String>) -> Vec<String> {
    let mut values = values
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    values.sort();
    values.dedup();
    values
}

async fn active_profile_paths(
    state: &State<'_, AppState>,
) -> Result<(ProfileScope, PathBuf, PathBuf), String> {
    let orchestrarium_dir = state.active_orchestrarium_dir().await?;
    match state.active_scope().await {
        "project" => {
            let project_root = state
                .project_dir
                .lock()
                .await
                .clone()
                .ok_or_else(|| "No project selected".to_string())?;
            Ok((
                ProfileScope::Project,
                orchestrarium_dir,
                project_mcp_json_path(&project_root),
            ))
        }
        _ => Ok((
            ProfileScope::Global,
            orchestrarium_dir,
            claude_json_path_for_global_dir(&state.global_dir)?,
        )),
    }
}

fn schedule_unsuppress(
    app: &tauri::AppHandle,
    watcher_state: std::sync::Arc<crate::watcher::WatcherState>,
) {
    let app = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        crate::state::unsuppress_and_flush(&watcher_state, &app).await;
    });
}

#[cfg(test)]
mod tests {
    use super::{
        activate_profile_in, create_profile_in, deactivate_profile_in, delete_profile_in,
        preview_activate_profile_in, read_managed_state_for, read_profile_in, save_profile_in,
        write_active_name_for, write_managed_state_for, ManagedStateFile, ProfileScope,
        StoredMcpProfileSnapshot,
    };
    use std::fs;
    use tempfile::TempDir;

    fn project_root(temp: &TempDir) -> std::path::PathBuf {
        temp.path().join("project")
    }

    fn orchestrarium_dir(temp: &TempDir) -> std::path::PathBuf {
        project_root(temp).join(".claude").join("orchestrarium")
    }

    fn project_live_config_path(temp: &TempDir) -> std::path::PathBuf {
        project_root(temp).join(".mcp.json")
    }

    fn global_home(temp: &TempDir) -> std::path::PathBuf {
        temp.path().join("home")
    }

    fn global_claude_dir(temp: &TempDir) -> std::path::PathBuf {
        global_home(temp).join(".claude")
    }

    fn global_orchestrarium_dir(temp: &TempDir) -> std::path::PathBuf {
        global_claude_dir(temp).join("orchestrarium")
    }

    fn global_claude_json_path(temp: &TempDir) -> std::path::PathBuf {
        global_home(temp).join(".claude.json")
    }

    fn write_file(path: &std::path::Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn read_file(path: &std::path::Path) -> String {
        fs::read_to_string(path).unwrap_or_default()
    }

    #[test]
    fn create_and_save_profile_roundtrip() {
        let temp = TempDir::new().unwrap();
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        create_profile_in(&orch, "backend-dev").unwrap();
        let created = read_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();
        assert_eq!(created.server_count, 0);

        save_profile_in(
            &orch,
            "backend-dev",
            r#"{
              "name": "ignored",
              "servers": {
                "filesystem": {
                  "type": "command",
                  "command": "npx"
                }
              }
            }"#,
        )
        .unwrap();

        let saved = read_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();
        assert_eq!(saved.server_count, 1);
        assert!(saved.content.contains("\"backend-dev\""));
        assert!(saved.content.contains("\"filesystem\""));
    }

    #[test]
    fn activate_profile_applies_servers_to_empty_project_mcp() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        save_profile_in(
            &orch,
            "backend-dev",
            r#"{
              "name": "backend-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/mcp"
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();

        let mcp_text = read_file(&project.join(".mcp.json"));
        assert!(mcp_text.contains("\"docs\""));
        assert!(mcp_text.contains("https://example.com/mcp"));

        let managed = read_managed_state_for(&orch).unwrap();
        assert_eq!(managed.active_profile.as_deref(), Some("backend-dev"));
        assert_eq!(managed.owned_servers, vec!["docs".to_string()]);
    }

    #[test]
    fn activate_profile_preserves_manual_live_servers() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        write_file(
            &project.join(".mcp.json"),
            r#"{
              "postgres": {
                "type": "command",
                "command": "node"
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "backend-dev",
            r#"{
              "name": "backend-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/mcp"
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();

        let mcp_text = read_file(&project.join(".mcp.json"));
        assert!(mcp_text.contains("\"postgres\""));
        assert!(mcp_text.contains("\"docs\""));
    }

    #[test]
    fn switch_active_profile_replaces_owned_servers_only() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        write_file(
            &project.join(".mcp.json"),
            r#"{
              "postgres": {
                "type": "command",
                "command": "node"
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "a",
            r#"{
              "name": "a",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/a"
                }
              }
            }"#,
        )
        .unwrap();

        save_profile_in(
            &orch,
            "b",
            r#"{
              "name": "b",
              "servers": {
                "filesystem": {
                  "type": "command",
                  "command": "npx"
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(&orch, ProfileScope::Project, &live_config_path, "a").unwrap();
        activate_profile_in(&orch, ProfileScope::Project, &live_config_path, "b").unwrap();

        let mcp_text = read_file(&project.join(".mcp.json"));
        assert!(mcp_text.contains("\"postgres\""));
        assert!(mcp_text.contains("\"filesystem\""));
        assert!(!mcp_text.contains("\"docs\""));
    }

    #[test]
    fn deactivate_preserves_manual_entries() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        write_file(
            &project.join(".mcp.json"),
            r#"{
              "postgres": {
                "type": "command",
                "command": "node"
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "backend-dev",
            r#"{
              "name": "backend-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/mcp"
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();
        deactivate_profile_in(&orch, ProfileScope::Project, &live_config_path).unwrap();

        let mcp_text = read_file(&project.join(".mcp.json"));
        assert!(mcp_text.contains("\"postgres\""));
        assert!(!mcp_text.contains("\"docs\""));
        assert!(!orch.join("mcp-profiles").join(".active").exists());
        assert!(!orch
            .join("mcp-profiles")
            .join(".managed-state.json")
            .exists());
    }

    #[test]
    fn delete_active_profile_is_rejected() {
        let temp = TempDir::new().unwrap();
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        create_profile_in(&orch, "backend-dev").unwrap();
        activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();

        let err = delete_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap_err();
        assert!(err.contains("Deactivate"));
    }

    #[test]
    fn preview_reports_name_collisions() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        write_file(
            &project.join(".mcp.json"),
            r#"{
              "docs": {
                "type": "http",
                "url": "https://manual.example.com"
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "backend-dev",
            r#"{
              "name": "backend-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/mcp"
                }
              }
            }"#,
        )
        .unwrap();

        let preview = preview_activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();
        assert!(!preview.can_activate);
        assert_eq!(preview.collisions, vec!["docs".to_string()]);
    }

    #[test]
    fn preview_reports_non_blocking_drift_for_owned_server_edit() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        create_profile_in(&orch, "backend-dev").unwrap();
        write_file(
            &project.join(".mcp.json"),
            r#"{
              "docs": {
                "type": "http",
                "url": "https://edited.example.com"
              }
            }"#,
        );
        write_active_name_for(&orch, "backend-dev").unwrap();
        write_managed_state_for(
            &orch,
            &ManagedStateFile {
                version: 1,
                active_profile: Some("backend-dev".into()),
                owned_servers: vec!["docs".into()],
                applied_profile_snapshot: Some(StoredMcpProfileSnapshot {
                    name: "backend-dev".into(),
                    servers: serde_json::from_str(
                        r#"{
                          "docs": {
                            "type": "http",
                            "url": "https://original.example.com"
                          }
                        }"#,
                    )
                    .unwrap(),
                }),
            },
        )
        .unwrap();

        let preview = preview_activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "backend-dev",
        )
        .unwrap();
        assert!(preview.can_activate);
        assert!(preview
            .issues
            .iter()
            .any(|issue| !issue.blocking && issue.message.contains("edited")));
    }

    #[test]
    fn profile_names_cannot_escape_profiles_directory() {
        let temp = TempDir::new().unwrap();
        let orch = orchestrarium_dir(&temp);

        let err = create_profile_in(&orch, "bad/name").unwrap_err();
        assert!(err.contains("path separators"));
    }

    #[test]
    fn save_profile_rejects_invalid_http_shape() {
        let temp = TempDir::new().unwrap();
        let orch = orchestrarium_dir(&temp);

        let err = save_profile_in(
            &orch,
            "broken-http",
            r#"{
              "name": "broken-http",
              "servers": {
                "docs": {
                  "type": "http"
                }
              }
            }"#,
        )
        .unwrap_err();

        assert!(err.contains("requires field 'url'"));
    }

    #[test]
    fn save_profile_rejects_conflicting_command_shape() {
        let temp = TempDir::new().unwrap();
        let orch = orchestrarium_dir(&temp);

        let err = save_profile_in(
            &orch,
            "broken-command",
            r#"{
              "name": "broken-command",
              "servers": {
                "filesystem": {
                  "type": "command",
                  "command": "npx",
                  "url": "https://example.com/not-valid"
                }
              }
            }"#,
        )
        .unwrap_err();

        assert!(err.contains("cannot define field 'url'"));
    }

    #[test]
    fn activate_command_profile_writes_stdio_type_for_cli_compatibility() {
        let temp = TempDir::new().unwrap();
        let project = project_root(&temp);
        let orch = orchestrarium_dir(&temp);
        let live_config_path = project_live_config_path(&temp);

        save_profile_in(
            &orch,
            "filesystem-tools",
            r#"{
              "name": "filesystem-tools",
              "servers": {
                "filesystem": {
                  "type": "command",
                  "command": "npx",
                  "args": ["-y", "@modelcontextprotocol/server-filesystem"]
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(
            &orch,
            ProfileScope::Project,
            &live_config_path,
            "filesystem-tools",
        )
        .unwrap();

        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(project.join(".mcp.json")).unwrap()).unwrap();
        assert_eq!(value["filesystem"]["type"], serde_json::json!("stdio"));

        let managed = read_managed_state_for(&orch).unwrap();
        assert_eq!(
            managed
                .applied_profile_snapshot
                .as_ref()
                .and_then(|snapshot| snapshot.servers.get("filesystem"))
                .and_then(|value| value.get("type"))
                .and_then(|value| value.as_str()),
            Some("stdio")
        );
    }

    #[test]
    fn activate_global_profile_applies_servers_to_claude_json() {
        let temp = TempDir::new().unwrap();
        let orch = global_orchestrarium_dir(&temp);
        let claude_json_path = global_claude_json_path(&temp);

        write_file(
            &claude_json_path,
            r#"{
              "mcpServers": {
                "github": {
                  "type": "http",
                  "url": "https://manual.example.com/mcp"
                }
              },
              "projects": {
                "C:/repo": {
                  "mcpServers": {
                    "project-only": {
                      "type": "command",
                      "command": "node"
                    }
                  }
                }
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "global-dev",
            r#"{
              "name": "global-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/global-mcp"
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(&orch, ProfileScope::Global, &claude_json_path, "global-dev").unwrap();

        let claude_text = read_file(&claude_json_path);
        assert!(claude_text.contains("\"github\""));
        assert!(claude_text.contains("\"docs\""));
        assert!(claude_text.contains("\"projects\""));

        let managed = read_managed_state_for(&orch).unwrap();
        assert_eq!(managed.active_profile.as_deref(), Some("global-dev"));
        assert_eq!(managed.owned_servers, vec!["docs".to_string()]);
    }

    #[test]
    fn deactivate_global_profile_preserves_manual_global_servers() {
        let temp = TempDir::new().unwrap();
        let orch = global_orchestrarium_dir(&temp);
        let claude_json_path = global_claude_json_path(&temp);

        write_file(
            &claude_json_path,
            r#"{
              "mcpServers": {
                "github": {
                  "type": "http",
                  "url": "https://manual.example.com/mcp"
                }
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "global-dev",
            r#"{
              "name": "global-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/global-mcp"
                }
              }
            }"#,
        )
        .unwrap();

        activate_profile_in(&orch, ProfileScope::Global, &claude_json_path, "global-dev").unwrap();
        deactivate_profile_in(&orch, ProfileScope::Global, &claude_json_path).unwrap();

        let claude_text = read_file(&claude_json_path);
        assert!(claude_text.contains("\"github\""));
        assert!(!claude_text.contains("\"docs\""));
        assert!(!orch.join("mcp-profiles").join(".active").exists());
        assert!(!orch
            .join("mcp-profiles")
            .join(".managed-state.json")
            .exists());
    }

    #[test]
    fn preview_reports_global_name_collisions() {
        let temp = TempDir::new().unwrap();
        let orch = global_orchestrarium_dir(&temp);
        let claude_json_path = global_claude_json_path(&temp);

        write_file(
            &claude_json_path,
            r#"{
              "mcpServers": {
                "docs": {
                  "type": "http",
                  "url": "https://manual.example.com/mcp"
                }
              }
            }"#,
        );

        save_profile_in(
            &orch,
            "global-dev",
            r#"{
              "name": "global-dev",
              "servers": {
                "docs": {
                  "type": "http",
                  "url": "https://example.com/global-mcp"
                }
              }
            }"#,
        )
        .unwrap();

        let preview = preview_activate_profile_in(
            &orch,
            ProfileScope::Global,
            &claude_json_path,
            "global-dev",
        )
        .unwrap();
        assert!(!preview.can_activate);
        assert_eq!(preview.collisions, vec!["docs".to_string()]);
    }
}

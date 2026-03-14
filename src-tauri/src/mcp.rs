use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum McpServerType {
    Command,
    Http,
    Sse,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum McpServerSource {
    ClaudeJson,
    McpJson,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum McpScope {
    Global,
    Project,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct McpServerSummary {
    pub id: String,
    pub name: String,
    pub source: McpServerSource,
    pub scope: McpScope,
    pub enabled: bool,
    pub server_type: McpServerType,
    pub project_path: Option<String>,
    pub can_toggle: bool,
    pub can_edit: bool,
    pub redacted_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct EditableMcpServer {
    pub id: String,
    pub name: String,
    pub server_type: McpServerType,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CreateMcpServerInput {
    pub name: String,
    pub server_type: McpServerType,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMcpServerInput {
    pub id: String,
    pub server_type: McpServerType,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: BTreeMap<String, String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawClaudeConfig {
    #[serde(default)]
    mcp_servers: BTreeMap<String, RawMcpServerConfig>,
    #[serde(default)]
    projects: BTreeMap<String, RawClaudeProjectConfig>,
    #[serde(flatten)]
    _extra: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawClaudeProjectConfig {
    #[serde(default)]
    mcp_servers: BTreeMap<String, RawMcpServerConfig>,
    #[serde(default)]
    enabled_mcpjson_servers: Vec<String>,
    #[serde(default)]
    disabled_mcpjson_servers: Vec<String>,
    #[serde(flatten)]
    _extra: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawMcpServerConfig {
    #[serde(default)]
    r#type: Option<String>,
    #[serde(default)]
    command: Option<String>,
    #[serde(default)]
    args: Option<Vec<String>>,
    #[serde(default)]
    env: Option<BTreeMap<String, String>>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    headers: Option<BTreeMap<String, String>>,
    #[serde(flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawProjectMcpFile {
    #[serde(default)]
    mcp_servers: BTreeMap<String, RawMcpServerConfig>,
    #[serde(skip)]
    wrapper: bool,
    #[serde(skip)]
    extra: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContextMode {
    Global,
    Project,
}

struct McpJsonServerId {
    project_path: String,
    name: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_mcp_servers(state: State<'_, AppState>) -> Result<Vec<McpServerSummary>, String> {
    let context = match state.active_scope().await {
        "project" => ContextMode::Project,
        _ => ContextMode::Global,
    };
    let project_dir = state.project_dir.lock().await.clone();

    list_mcp_servers_for_context(&state.global_dir, context, project_dir.as_deref())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_mcp_server(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
    enable: bool,
) -> Result<McpServerSummary, String> {
    if state.active_scope().await != "project" {
        return Err("MCP toggle is only available in project context".into());
    }

    let project_root = state
        .project_dir
        .lock()
        .await
        .clone()
        .ok_or("No project selected")?;
    state.begin_suppression().await;
    schedule_unsuppress(&app, state.watcher_state.clone());
    let _lock = state.mcp_lock.lock().await;

    toggle_mcp_server_for_project(&state.global_dir, &project_root, &id, enable)
}

#[tauri::command]
#[specta::specta]
pub async fn get_mcp_server_detail(
    state: State<'_, AppState>,
    id: String,
) -> Result<EditableMcpServer, String> {
    if state.active_scope().await != "project" {
        return Err("MCP editing is only available in project context".into());
    }

    let project_root = state
        .project_dir
        .lock()
        .await
        .clone()
        .ok_or("No project selected")?;

    get_mcp_server_detail_for_project(&project_root, &id)
}

#[tauri::command]
#[specta::specta]
pub async fn create_mcp_server(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: CreateMcpServerInput,
) -> Result<McpServerSummary, String> {
    if state.active_scope().await != "project" {
        return Err("MCP creation is only available in project context".into());
    }

    let project_root = state
        .project_dir
        .lock()
        .await
        .clone()
        .ok_or("No project selected")?;
    state.begin_suppression().await;
    schedule_unsuppress(&app, state.watcher_state.clone());
    let _lock = state.mcp_lock.lock().await;

    create_mcp_server_for_project(&state.global_dir, &project_root, input)
}

#[tauri::command]
#[specta::specta]
pub async fn update_mcp_server(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    input: UpdateMcpServerInput,
) -> Result<McpServerSummary, String> {
    if state.active_scope().await != "project" {
        return Err("MCP editing is only available in project context".into());
    }

    let project_root = state
        .project_dir
        .lock()
        .await
        .clone()
        .ok_or("No project selected")?;
    state.begin_suppression().await;
    schedule_unsuppress(&app, state.watcher_state.clone());
    let _lock = state.mcp_lock.lock().await;

    update_mcp_server_for_project(&state.global_dir, &project_root, input)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_mcp_server(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    if state.active_scope().await != "project" {
        return Err("MCP deletion is only available in project context".into());
    }

    let project_root = state
        .project_dir
        .lock()
        .await
        .clone()
        .ok_or("No project selected")?;
    state.begin_suppression().await;
    schedule_unsuppress(&app, state.watcher_state.clone());
    let _lock = state.mcp_lock.lock().await;

    delete_mcp_server_for_project(&state.global_dir, &project_root, &id)
}

fn list_mcp_servers_for_context(
    global_dir: &Path,
    context: ContextMode,
    project_dir: Option<&Path>,
) -> Result<Vec<McpServerSummary>, String> {
    let claude_json_path = claude_json_path(global_dir)?;
    let claude_config = read_claude_config(&claude_json_path)?;

    let mut servers = Vec::new();

    for (name, config) in &claude_config.mcp_servers {
        servers.push(build_summary(
            name,
            config,
            McpServerSource::ClaudeJson,
            McpScope::Global,
            true,
            None,
            false,
        )?);
    }

    if context == ContextMode::Project {
        let project_root = project_dir.ok_or("No project selected")?;
        let project_path = display_path(project_root);
        if let Some(project_config) = find_project_config(&claude_config.projects, project_root) {
            for (name, config) in &project_config.mcp_servers {
                servers.push(build_summary(
                    name,
                    config,
                    McpServerSource::ClaudeJson,
                    McpScope::Project,
                    true,
                    Some(project_path.clone()),
                    false,
                )?);
            }

            for (name, config) in read_project_mcp_servers(project_root)? {
                servers.push(build_summary(
                    &name,
                    &config,
                    McpServerSource::McpJson,
                    McpScope::Project,
                    derive_mcp_json_enabled(name.as_str(), project_config),
                    Some(project_path.clone()),
                    true,
                )?);
            }
        } else {
            for (name, config) in read_project_mcp_servers(project_root)? {
                servers.push(build_summary(
                    &name,
                    &config,
                    McpServerSource::McpJson,
                    McpScope::Project,
                    true,
                    Some(project_path.clone()),
                    true,
                )?);
            }
        }
    }

    servers.sort_by(|a, b| {
        scope_rank(&a.scope)
            .cmp(&scope_rank(&b.scope))
            .then(source_rank(&a.source).cmp(&source_rank(&b.source)))
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(servers)
}

fn build_summary(
    name: &str,
    config: &RawMcpServerConfig,
    source: McpServerSource,
    scope: McpScope,
    enabled: bool,
    project_path: Option<String>,
    can_toggle: bool,
) -> Result<McpServerSummary, String> {
    let normalized_project = project_path.clone();
    Ok(McpServerSummary {
        id: match (&source, &scope, normalized_project.as_ref()) {
            (McpServerSource::ClaudeJson, McpScope::Global, _) => {
                format!("claude-json-global::{}", name)
            }
            (McpServerSource::ClaudeJson, McpScope::Project, Some(project)) => {
                format!("claude-json-project::{}::{}", project, name)
            }
            (McpServerSource::McpJson, McpScope::Project, Some(project)) => {
                format!("mcp-json::{}::{}", project, name)
            }
            _ => return Err(format!("Cannot build MCP id for '{}'", name)),
        },
        name: name.to_string(),
        source,
        scope,
        enabled,
        server_type: infer_server_type(config),
        project_path,
        can_toggle,
        can_edit: can_toggle && supports_structured_edit(config),
        redacted_preview: redacted_preview(config)?,
    })
}

fn toggle_mcp_server_for_project(
    global_dir: &Path,
    project_root: &Path,
    id: &str,
    enable: bool,
) -> Result<McpServerSummary, String> {
    let target = parse_mcp_json_id(id)?;
    if normalize_path_str(&target.project_path) != normalize_path(project_root) {
        return Err("MCP server does not belong to the selected project".into());
    }

    let project_servers = read_project_mcp_servers(project_root)?;
    if !project_servers.contains_key(&target.name) {
        return Err(format!(
            "Cannot toggle MCP server '{}': not found in project .mcp.json",
            target.name
        ));
    }

    let claude_path = claude_json_path(global_dir)?;
    mutate_claude_config_with_retry(&claude_path, |config| {
        let project_entry = get_or_create_project_entry(&mut config.projects, project_root);
        set_mcp_json_enabled(project_entry, &target.name, enable);
        Ok(())
    })?;

    list_mcp_servers_for_context(global_dir, ContextMode::Project, Some(project_root))?
        .into_iter()
        .find(|server| server.id == id)
        .ok_or_else(|| format!("Failed to reload MCP server '{}'", target.name))
}

fn get_mcp_server_detail_for_project(
    project_root: &Path,
    id: &str,
) -> Result<EditableMcpServer, String> {
    let target = parse_target_for_project(project_root, id)?;
    let project_servers = read_project_mcp_servers(project_root)?;
    let config = project_servers
        .get(&target.name)
        .ok_or_else(|| format!("MCP server '{}' not found", target.name))?;

    if !supports_structured_edit(config) {
        return Err("Structured edit is unavailable for this MCP server in V1".into());
    }

    Ok(to_editable_mcp_server(project_root, &target.name, config))
}

fn create_mcp_server_for_project(
    global_dir: &Path,
    project_root: &Path,
    input: CreateMcpServerInput,
) -> Result<McpServerSummary, String> {
    let name = validate_server_name(&input.name)?;
    let config = config_from_parts(
        input.server_type,
        input.command,
        input.args,
        input.env,
        input.url,
        input.headers,
    )?;
    let mcp_json_path = project_mcp_json_path(project_root);

    mutate_project_mcp_file_with_retry(&mcp_json_path, |file| {
        if file.mcp_servers.contains_key(&name) {
            return Err(format!("MCP server '{}' already exists", name));
        }
        file.mcp_servers.insert(name.clone(), config.clone());
        Ok(())
    })?;

    let id = format!("mcp-json::{}::{}", display_path(project_root), name);
    list_mcp_servers_for_context(global_dir, ContextMode::Project, Some(project_root))?
        .into_iter()
        .find(|server| server.id == id)
        .ok_or_else(|| format!("Failed to reload MCP server '{}'", name))
}

fn update_mcp_server_for_project(
    global_dir: &Path,
    project_root: &Path,
    input: UpdateMcpServerInput,
) -> Result<McpServerSummary, String> {
    let UpdateMcpServerInput {
        id,
        server_type,
        command,
        args,
        env,
        url,
        headers,
    } = input;
    let target = parse_target_for_project(project_root, &id)?;
    let config = config_from_parts(server_type, command, args, env, url, headers)?;
    let mcp_json_path = project_mcp_json_path(project_root);

    mutate_project_mcp_file_with_retry(&mcp_json_path, |file| {
        let existing = file
            .mcp_servers
            .get(&target.name)
            .ok_or_else(|| format!("MCP server '{}' not found", target.name))?;
        if !supports_structured_edit(existing) {
            return Err("Structured edit is unavailable for this MCP server in V1".into());
        }

        file.mcp_servers.insert(target.name.clone(), config.clone());
        Ok(())
    })?;

    list_mcp_servers_for_context(global_dir, ContextMode::Project, Some(project_root))?
        .into_iter()
        .find(|server| server.id == id)
        .ok_or_else(|| format!("Failed to reload MCP server '{}'", target.name))
}

fn delete_mcp_server_for_project(
    global_dir: &Path,
    project_root: &Path,
    id: &str,
) -> Result<(), String> {
    let target = parse_target_for_project(project_root, id)?;
    let mcp_json_path = project_mcp_json_path(project_root);

    mutate_project_mcp_file_with_retry(&mcp_json_path, |file| {
        if file.mcp_servers.remove(&target.name).is_none() {
            return Err(format!("MCP server '{}' not found", target.name));
        }
        Ok(())
    })?;

    let claude_path = claude_json_path(global_dir)?;
    mutate_claude_config_with_retry(&claude_path, |config| {
        if let Some(project_entry) = find_project_config_mut(&mut config.projects, project_root) {
            project_entry
                .enabled_mcpjson_servers
                .retain(|entry| entry != &target.name);
            project_entry
                .disabled_mcpjson_servers
                .retain(|entry| entry != &target.name);
        }
        Ok(())
    })?;

    Ok(())
}

fn parse_target_for_project(project_root: &Path, id: &str) -> Result<McpJsonServerId, String> {
    let target = parse_mcp_json_id(id)?;
    if normalize_path_str(&target.project_path) != normalize_path(project_root) {
        return Err("MCP server does not belong to the selected project".into());
    }
    Ok(target)
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

fn claude_json_path(global_dir: &Path) -> Result<PathBuf, String> {
    let home = global_dir
        .parent()
        .ok_or("Failed to resolve home directory for .claude.json")?;
    Ok(home.join(".claude.json"))
}

fn read_claude_config(path: &Path) -> Result<RawClaudeConfig, String> {
    if !path.exists() {
        return Ok(RawClaudeConfig::default());
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn read_project_mcp_servers(
    project_root: &Path,
) -> Result<BTreeMap<String, RawMcpServerConfig>, String> {
    Ok(read_project_mcp_file(&project_mcp_json_path(project_root))?.mcp_servers)
}

fn find_project_config<'a>(
    projects: &'a BTreeMap<String, RawClaudeProjectConfig>,
    project_root: &Path,
) -> Option<&'a RawClaudeProjectConfig> {
    let expected = normalize_path(project_root);
    projects
        .iter()
        .find(|(path, _)| normalize_path_str(path) == expected)
        .map(|(_, config)| config)
}

fn find_project_config_mut<'a>(
    projects: &'a mut BTreeMap<String, RawClaudeProjectConfig>,
    project_root: &Path,
) -> Option<&'a mut RawClaudeProjectConfig> {
    let expected = normalize_path(project_root);
    let existing_key = projects
        .keys()
        .find(|key| normalize_path_str(key) == expected)
        .cloned()?;
    projects.get_mut(&existing_key)
}

fn get_or_create_project_entry<'a>(
    projects: &'a mut BTreeMap<String, RawClaudeProjectConfig>,
    project_root: &Path,
) -> &'a mut RawClaudeProjectConfig {
    let expected = normalize_path(project_root);
    if let Some(existing_key) = projects
        .keys()
        .find(|key| normalize_path_str(key) == expected)
        .cloned()
    {
        return projects.get_mut(&existing_key).unwrap();
    }

    projects.entry(display_path(project_root)).or_default()
}

fn derive_mcp_json_enabled(name: &str, config: &RawClaudeProjectConfig) -> bool {
    if config
        .enabled_mcpjson_servers
        .iter()
        .any(|entry| entry == name)
    {
        return true;
    }

    if config
        .disabled_mcpjson_servers
        .iter()
        .any(|entry| entry == name)
    {
        return false;
    }

    true
}

fn set_mcp_json_enabled(config: &mut RawClaudeProjectConfig, name: &str, enable: bool) {
    config.enabled_mcpjson_servers.retain(|entry| entry != name);
    config
        .disabled_mcpjson_servers
        .retain(|entry| entry != name);
    if enable {
        config.enabled_mcpjson_servers.push(name.to_string());
    } else {
        config.disabled_mcpjson_servers.push(name.to_string());
    }
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

fn supports_structured_edit(config: &RawMcpServerConfig) -> bool {
    if !config.extra.is_empty() {
        return false;
    }

    match infer_server_type(config) {
        McpServerType::Command => {
            config.command.is_some()
                && config.url.is_none()
                && config
                    .headers
                    .as_ref()
                    .map(|headers| headers.is_empty())
                    .unwrap_or(true)
        }
        McpServerType::Http | McpServerType::Sse => {
            config.url.is_some()
                && config.command.is_none()
                && config
                    .args
                    .as_ref()
                    .map(|args| args.is_empty())
                    .unwrap_or(true)
                && config
                    .env
                    .as_ref()
                    .map(|env| env.is_empty())
                    .unwrap_or(true)
        }
    }
}

fn to_editable_mcp_server(
    project_root: &Path,
    name: &str,
    config: &RawMcpServerConfig,
) -> EditableMcpServer {
    EditableMcpServer {
        id: format!("mcp-json::{}::{}", display_path(project_root), name),
        name: name.to_string(),
        server_type: infer_server_type(config),
        command: config.command.clone(),
        args: config.args.clone().unwrap_or_default(),
        env: config.env.clone().unwrap_or_default(),
        url: config.url.clone(),
        headers: config.headers.clone().unwrap_or_default(),
    }
}

fn validate_server_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("MCP server name is required".into());
    }
    if trimmed.contains("::") {
        return Err("MCP server name cannot contain '::'".into());
    }
    Ok(trimmed.to_string())
}

fn config_from_parts(
    server_type: McpServerType,
    command: Option<String>,
    args: Vec<String>,
    env: BTreeMap<String, String>,
    url: Option<String>,
    headers: BTreeMap<String, String>,
) -> Result<RawMcpServerConfig, String> {
    let command = trim_optional(command);
    let url = trim_optional(url);
    let args = args
        .into_iter()
        .map(|arg| arg.trim().to_string())
        .filter(|arg| !arg.is_empty())
        .collect::<Vec<_>>();

    match server_type {
        McpServerType::Command => {
            let command = command.ok_or("Command MCP servers require a command")?;
            if url.is_some() {
                return Err("Command MCP servers cannot define a URL".into());
            }
            if !headers.is_empty() {
                return Err("Command MCP servers cannot define headers".into());
            }
            Ok(RawMcpServerConfig {
                r#type: Some("command".into()),
                command: Some(command),
                args: (!args.is_empty()).then_some(args),
                env: (!env.is_empty()).then_some(normalize_string_map(env)),
                url: None,
                headers: None,
                extra: BTreeMap::new(),
            })
        }
        McpServerType::Http | McpServerType::Sse => {
            let url = url.ok_or("HTTP and SSE MCP servers require a URL")?;
            if command.is_some() {
                return Err("HTTP and SSE MCP servers cannot define a command".into());
            }
            if !args.is_empty() {
                return Err("HTTP and SSE MCP servers cannot define args".into());
            }
            if !env.is_empty() {
                return Err("HTTP and SSE MCP servers cannot define env".into());
            }
            Ok(RawMcpServerConfig {
                r#type: Some(match server_type {
                    McpServerType::Http => "http".into(),
                    McpServerType::Sse => "sse".into(),
                    McpServerType::Command => unreachable!(),
                }),
                command: None,
                args: None,
                env: None,
                url: Some(url),
                headers: (!headers.is_empty()).then_some(normalize_string_map(headers)),
                extra: BTreeMap::new(),
            })
        }
    }
}

fn trim_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn normalize_string_map(entries: BTreeMap<String, String>) -> BTreeMap<String, String> {
    entries
        .into_iter()
        .filter_map(|(key, value)| {
            let trimmed_key = key.trim().to_string();
            (!trimmed_key.is_empty()).then_some((trimmed_key, value))
        })
        .collect()
}

pub(crate) fn global_mcp_watch_snapshot(global_dir: &Path) -> String {
    let claude_path = match claude_json_path(global_dir) {
        Ok(path) => path,
        Err(error) => return format!("claude-path-error:{error}"),
    };
    global_mcp_watch_snapshot_from_path(&claude_path)
}

pub(crate) fn project_mcp_watch_snapshot(global_dir: &Path, project_root: &Path) -> String {
    let claude_path = match claude_json_path(global_dir) {
        Ok(path) => path,
        Err(error) => return format!("claude-path-error:{error}"),
    };
    let mcp_json_path = project_mcp_json_path(project_root);
    project_mcp_watch_snapshot_from_paths(&claude_path, &mcp_json_path, project_root)
}

fn global_mcp_watch_snapshot_from_path(claude_path: &Path) -> String {
    let content = match read_optional_text(claude_path) {
        Ok(content) => content,
        Err(error) => return format!("claude-read-error:{error}"),
    };

    match parse_claude_config_text(&content, claude_path) {
        Ok(config) => serde_json::to_string(&config.mcp_servers)
            .unwrap_or_else(|error| format!("claude-serialize-error:{error}")),
        Err(_) => format!("claude-invalid:{content}"),
    }
}

fn project_mcp_watch_snapshot_from_paths(
    claude_path: &Path,
    mcp_json_path: &Path,
    project_root: &Path,
) -> String {
    let claude_content = match read_optional_text(claude_path) {
        Ok(content) => content,
        Err(error) => return format!("claude-read-error:{error}"),
    };
    let project_config_snapshot = match parse_claude_config_text(&claude_content, claude_path) {
        Ok(config) => {
            let mut enabled = Vec::new();
            let mut disabled = Vec::new();
            let mut project_servers = BTreeMap::new();
            if let Some(project) = find_project_config(&config.projects, project_root) {
                enabled = project.enabled_mcpjson_servers.clone();
                disabled = project.disabled_mcpjson_servers.clone();
                enabled.sort();
                disabled.sort();
                project_servers = project.mcp_servers.clone();
            }
            serde_json::json!({
                "projectMcpServers": project_servers,
                "enabledMcpjsonServers": enabled,
                "disabledMcpjsonServers": disabled,
            })
        }
        Err(_) => return format!("claude-invalid:{claude_content}"),
    };

    let mcp_content = match read_optional_text(mcp_json_path) {
        Ok(content) => content,
        Err(error) => return format!("mcp-read-error:{error}"),
    };
    let project_mcp_snapshot = match parse_project_mcp_file_text(&mcp_content, mcp_json_path) {
        Ok(file) => serde_json::to_value(&file.mcp_servers)
            .unwrap_or_else(|error| serde_json::json!({ "serializeError": error.to_string() })),
        Err(_) => return format!("mcp-invalid:{mcp_content}"),
    };

    serde_json::to_string(&serde_json::json!({
        "claudeProject": project_config_snapshot,
        "projectMcpJson": project_mcp_snapshot,
    }))
    .unwrap_or_else(|error| format!("snapshot-serialize-error:{error}"))
}

fn infer_server_type(config: &RawMcpServerConfig) -> McpServerType {
    match config.r#type.as_deref() {
        Some("http") => McpServerType::Http,
        Some("sse") => McpServerType::Sse,
        Some("command") => McpServerType::Command,
        _ if config.command.is_some() => McpServerType::Command,
        _ if config.url.is_some() => McpServerType::Http,
        _ => McpServerType::Command,
    }
}

fn redacted_preview(config: &RawMcpServerConfig) -> Result<String, String> {
    let mut value = serde_json::to_value(config)
        .map_err(|e| format!("Failed to serialize MCP config for preview: {}", e))?;
    redact_value(&mut value, false);
    serde_json::to_string_pretty(&value).map_err(|e| format!("Failed to format MCP preview: {}", e))
}

fn redact_value(value: &mut Value, force_redaction: bool) {
    match value {
        Value::Object(map) => {
            for (key, nested) in map.iter_mut() {
                let lower = key.to_ascii_lowercase();
                let nested_force = force_redaction || lower == "env" || lower == "headers";
                if should_redact_key(&lower) {
                    redact_entire_value(nested);
                } else {
                    redact_value(nested, nested_force);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                redact_value(item, force_redaction);
            }
        }
        Value::String(text) if force_redaction => {
            *text = mask_secret(text);
        }
        _ => {}
    }
}

fn redact_entire_value(value: &mut Value) {
    match value {
        Value::String(text) => *text = mask_secret(text),
        Value::Array(items) => {
            for item in items {
                redact_entire_value(item);
            }
        }
        Value::Object(map) => {
            for nested in map.values_mut() {
                redact_entire_value(nested);
            }
        }
        _ => {}
    }
}

fn should_redact_key(lowercase_key: &str) -> bool {
    ["key", "token", "secret", "password", "authorization"]
        .iter()
        .any(|needle| lowercase_key.contains(needle))
}

fn mask_secret(value: &str) -> String {
    let char_count = value.chars().count();
    if char_count <= 8 {
        return "******".to_string();
    }

    let prefix: String = value.chars().take(4).collect();
    let suffix: String = value
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    format!("{}...{}", prefix, suffix)
}

fn normalize_path(path: &Path) -> String {
    normalize_path_str(&path.to_string_lossy())
}

fn display_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string()
}

fn parse_mcp_json_id(id: &str) -> Result<McpJsonServerId, String> {
    let rest = id
        .strip_prefix("mcp-json::")
        .ok_or("Only .mcp.json-backed servers can be toggled in V1")?;
    let (project_path, name) = rest.rsplit_once("::").ok_or("Invalid MCP server id")?;
    if project_path.is_empty() || name.is_empty() {
        return Err("Invalid MCP server id".into());
    }
    Ok(McpJsonServerId {
        project_path: project_path.to_string(),
        name: name.to_string(),
    })
}

fn normalize_path_str(path: &str) -> String {
    path.replace('\\', "/")
        .trim_end_matches('/')
        .to_ascii_lowercase()
}

fn scope_rank(scope: &McpScope) -> u8 {
    match scope {
        McpScope::Global => 0,
        McpScope::Project => 1,
    }
}

fn source_rank(source: &McpServerSource) -> u8 {
    match source {
        McpServerSource::ClaudeJson => 0,
        McpServerSource::McpJson => 1,
    }
}

fn read_optional_text(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

fn parse_claude_config_text(content: &str, path: &Path) -> Result<RawClaudeConfig, String> {
    if content.trim().is_empty() {
        return Ok(RawClaudeConfig::default());
    }
    serde_json::from_str(content).map_err(|e| format!("Failed to parse {}: {}", path.display(), e))
}

fn mutate_claude_config_with_retry<F>(path: &Path, mutator: F) -> Result<(), String>
where
    F: Fn(&mut RawClaudeConfig) -> Result<(), String>,
{
    for attempt in 0..2 {
        let original_content = read_optional_text(path)?;
        let mut config = parse_claude_config_text(&original_content, path)?;
        mutator(&mut config)?;

        let serialized = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Failed to serialize {}: {}", path.display(), e))?;

        // Best-effort optimistic concurrency: detect if another process changed the file
        // while we were computing our mutation and retry once before surfacing a conflict.
        let current_content = read_optional_text(path)?;
        if current_content != original_content {
            if attempt == 0 {
                continue;
            }
            return Err("Claude configuration changed during MCP update; please retry".into());
        }

        atomic_write(path, &serialized)?;
        return Ok(());
    }

    Err("Failed to update Claude configuration".into())
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

#[cfg(test)]
mod tests {
    use super::{
        create_mcp_server_for_project, delete_mcp_server_for_project,
        global_mcp_watch_snapshot_from_path, list_mcp_servers_for_context,
        project_mcp_watch_snapshot_from_paths, toggle_mcp_server_for_project,
        update_mcp_server_for_project, ContextMode, CreateMcpServerInput, McpScope,
        McpServerSource, McpServerType, UpdateMcpServerInput,
    };
    use std::fs;
    use tempfile::TempDir;

    fn write_file(path: &std::path::Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn test_global_context_reads_top_level_claude_json_mcp_servers() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        fs::create_dir_all(&global_dir).unwrap();
        write_file(
            &temp.path().join(".claude.json"),
            r#"{
              "mcpServers": {
                "github": {
                  "type": "http",
                  "url": "https://api.githubcopilot.com/mcp/",
                  "headers": {
                    "Authorization": "Bearer secret-token"
                  }
                }
              }
            }"#,
        );

        let servers = list_mcp_servers_for_context(&global_dir, ContextMode::Global, None).unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].name, "github");
        assert_eq!(servers[0].scope, McpScope::Global);
        assert_eq!(servers[0].source, McpServerSource::ClaudeJson);
        assert_eq!(servers[0].server_type, McpServerType::Http);
        assert!(servers[0].enabled);
        assert!(servers[0].redacted_preview.contains("Bear...oken"));
    }

    #[test]
    fn test_project_context_merges_global_project_and_mcp_json_sources() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        let project_root = temp.path().join("project-a");
        fs::create_dir_all(&global_dir).unwrap();
        fs::create_dir_all(&project_root).unwrap();

        write_file(
            &temp.path().join(".claude.json"),
            &format!(
                r#"{{
                  "mcpServers": {{
                    "global-http": {{
                      "type": "http",
                      "url": "https://example.com/mcp"
                    }}
                  }},
                  "projects": {{
                    "{}": {{
                      "mcpServers": {{
                        "project-sse": {{
                          "type": "sse",
                          "url": "https://example.com/events"
                        }}
                      }},
                      "enabledMcpjsonServers": ["local-enabled"],
                      "disabledMcpjsonServers": ["local-disabled"]
                    }}
                  }}
                }}"#,
                project_root.to_string_lossy().replace('\\', "/")
            ),
        );

        write_file(
            &project_root.join(".mcp.json"),
            r#"{
              "local-enabled": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem"]
              },
              "local-disabled": {
                "command": "uvx",
                "args": ["mcp-server"]
              }
            }"#,
        );

        let servers =
            list_mcp_servers_for_context(&global_dir, ContextMode::Project, Some(&project_root))
                .unwrap();

        assert_eq!(servers.len(), 4);
        assert_eq!(servers[0].name, "global-http");
        assert_eq!(servers[0].scope, McpScope::Global);
        assert_eq!(servers[1].name, "project-sse");
        assert_eq!(servers[1].scope, McpScope::Project);

        let local_enabled = servers
            .iter()
            .find(|server| server.name == "local-enabled")
            .unwrap();
        assert_eq!(local_enabled.source, McpServerSource::McpJson);
        assert_eq!(local_enabled.server_type, McpServerType::Command);
        assert!(local_enabled.enabled);
        assert!(local_enabled.can_toggle);
        assert!(local_enabled.can_edit);

        let local_disabled = servers
            .iter()
            .find(|server| server.name == "local-disabled")
            .unwrap();
        assert!(!local_disabled.enabled);
    }

    #[test]
    fn test_project_context_defaults_mcp_json_entries_to_enabled_without_arrays() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        let project_root = temp.path().join("project-b");
        fs::create_dir_all(&global_dir).unwrap();
        fs::create_dir_all(&project_root).unwrap();

        write_file(
            &temp.path().join(".claude.json"),
            &format!(
                r#"{{
                  "projects": {{
                    "{}": {{}}
                  }}
                }}"#,
                project_root.to_string_lossy().replace('\\', "/")
            ),
        );
        write_file(
            &project_root.join(".mcp.json"),
            r#"{
              "local-default": {
                "command": "node",
                "args": ["server.js"],
                "env": {
                  "API_KEY": "super-secret"
                }
              }
            }"#,
        );

        let servers =
            list_mcp_servers_for_context(&global_dir, ContextMode::Project, Some(&project_root))
                .unwrap();
        assert_eq!(servers.len(), 1);
        assert!(servers[0].enabled);
        assert!(servers[0].redacted_preview.contains("supe...cret"));
    }

    #[test]
    fn test_mcp_json_with_nested_mcp_servers_key_is_supported() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        let project_root = temp.path().join("project-c");
        fs::create_dir_all(&global_dir).unwrap();
        fs::create_dir_all(&project_root).unwrap();

        write_file(
            &project_root.join(".mcp.json"),
            r#"{
              "mcpServers": {
                "wrapped": {
                  "type": "sse",
                  "url": "https://example.com/events"
                }
              }
            }"#,
        );

        let servers =
            list_mcp_servers_for_context(&global_dir, ContextMode::Project, Some(&project_root))
                .unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].name, "wrapped");
        assert_eq!(servers[0].server_type, McpServerType::Sse);
    }

    #[test]
    fn test_toggle_mcp_server_updates_enabled_and_disabled_arrays() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        let project_root = temp.path().join("project-d");
        fs::create_dir_all(&global_dir).unwrap();
        fs::create_dir_all(&project_root).unwrap();

        write_file(
            &temp.path().join(".claude.json"),
            &format!(
                r#"{{
                  "projects": {{
                    "{}": {{
                      "enabledMcpjsonServers": ["alpha"],
                      "disabledMcpjsonServers": ["beta"]
                    }}
                  }}
                }}"#,
                project_root.to_string_lossy().replace('\\', "/")
            ),
        );
        write_file(
            &project_root.join(".mcp.json"),
            r#"{
              "alpha": { "command": "node", "args": ["alpha.js"] },
              "beta": { "command": "node", "args": ["beta.js"] }
            }"#,
        );

        let disabled = toggle_mcp_server_for_project(
            &global_dir,
            &project_root,
            &format!(
                "mcp-json::{}::alpha",
                project_root.to_string_lossy().replace('\\', "/")
            ),
            false,
        )
        .unwrap();
        assert!(!disabled.enabled);

        let enabled = toggle_mcp_server_for_project(
            &global_dir,
            &project_root,
            &format!(
                "mcp-json::{}::beta",
                project_root.to_string_lossy().replace('\\', "/")
            ),
            true,
        )
        .unwrap();
        assert!(enabled.enabled);

        let claude_json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(temp.path().join(".claude.json")).unwrap())
                .unwrap();
        let project_key = project_root.to_string_lossy().replace('\\', "/");
        let project_config = &claude_json["projects"][&project_key];
        assert_eq!(
            project_config["enabledMcpjsonServers"],
            serde_json::json!(["beta"])
        );
        assert_eq!(
            project_config["disabledMcpjsonServers"],
            serde_json::json!(["alpha"])
        );
    }

    #[test]
    fn test_create_and_update_mcp_server_preserve_wrapper_file_shape() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        let project_root = temp.path().join("project-e");
        fs::create_dir_all(&global_dir).unwrap();
        fs::create_dir_all(&project_root).unwrap();

        write_file(
            &project_root.join(".mcp.json"),
            r#"{
              "$schema": "https://example.com/mcp.schema.json",
              "mcpServers": {
                "alpha": {
                  "command": "node",
                  "args": ["alpha.js"]
                }
              }
            }"#,
        );

        let created = create_mcp_server_for_project(
            &global_dir,
            &project_root,
            CreateMcpServerInput {
                name: "beta".into(),
                server_type: McpServerType::Command,
                command: Some("npx".into()),
                args: vec!["-y".into(), "@modelcontextprotocol/server-memory".into()],
                env: std::collections::BTreeMap::new(),
                url: None,
                headers: std::collections::BTreeMap::new(),
            },
        )
        .unwrap();
        assert_eq!(created.name, "beta");
        assert!(created.can_edit);

        let updated = update_mcp_server_for_project(
            &global_dir,
            &project_root,
            UpdateMcpServerInput {
                id: created.id.clone(),
                server_type: McpServerType::Sse,
                command: None,
                args: vec![],
                env: std::collections::BTreeMap::new(),
                url: Some("https://example.com/events".into()),
                headers: std::collections::BTreeMap::from([(
                    "Authorization".into(),
                    "Bearer token".into(),
                )]),
            },
        )
        .unwrap();
        assert_eq!(updated.server_type, McpServerType::Sse);

        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(project_root.join(".mcp.json")).unwrap())
                .unwrap();
        assert_eq!(
            value["$schema"],
            serde_json::json!("https://example.com/mcp.schema.json")
        );
        assert_eq!(
            value["mcpServers"]["beta"]["type"],
            serde_json::json!("sse")
        );
        assert_eq!(
            value["mcpServers"]["beta"]["url"],
            serde_json::json!("https://example.com/events")
        );
        assert_eq!(
            value["mcpServers"]["beta"]["headers"]["Authorization"],
            serde_json::json!("Bearer token")
        );
    }

    #[test]
    fn test_delete_mcp_server_removes_override_entries() {
        let temp = TempDir::new().unwrap();
        let global_dir = temp.path().join(".claude");
        let project_root = temp.path().join("project-f");
        fs::create_dir_all(&global_dir).unwrap();
        fs::create_dir_all(&project_root).unwrap();

        write_file(
            &temp.path().join(".claude.json"),
            &format!(
                r#"{{
                  "projects": {{
                    "{}": {{
                      "enabledMcpjsonServers": ["filesystem"],
                      "disabledMcpjsonServers": ["unused"]
                    }}
                  }}
                }}"#,
                project_root.to_string_lossy().replace('\\', "/")
            ),
        );
        write_file(
            &project_root.join(".mcp.json"),
            r#"{
              "filesystem": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem"]
              },
              "unused": {
                "command": "node",
                "args": ["server.js"]
              }
            }"#,
        );

        delete_mcp_server_for_project(
            &global_dir,
            &project_root,
            &format!(
                "mcp-json::{}::filesystem",
                project_root.to_string_lossy().replace('\\', "/")
            ),
        )
        .unwrap();

        let mcp_json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(project_root.join(".mcp.json")).unwrap())
                .unwrap();
        assert!(mcp_json.get("filesystem").is_none());

        let claude_json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(temp.path().join(".claude.json")).unwrap())
                .unwrap();
        let project_key = project_root.to_string_lossy().replace('\\', "/");
        let project_config = &claude_json["projects"][&project_key];
        assert_eq!(
            project_config["enabledMcpjsonServers"],
            serde_json::json!([])
        );
        assert_eq!(
            project_config["disabledMcpjsonServers"],
            serde_json::json!(["unused"])
        );
    }

    #[test]
    fn test_global_mcp_snapshot_ignores_unrelated_claude_json_changes() {
        let temp = TempDir::new().unwrap();
        let claude_json_path = temp.path().join(".claude.json");

        write_file(
            &claude_json_path,
            r#"{
              "theme": "dark",
              "mcpServers": {
                "github": {
                  "type": "http",
                  "url": "https://example.com/mcp"
                }
              },
              "history": ["one"]
            }"#,
        );
        let initial = global_mcp_watch_snapshot_from_path(&claude_json_path);

        write_file(
            &claude_json_path,
            r#"{
              "theme": "light",
              "mcpServers": {
                "github": {
                  "type": "http",
                  "url": "https://example.com/mcp"
                }
              },
              "history": ["two", "three"]
            }"#,
        );
        let unrelated_change = global_mcp_watch_snapshot_from_path(&claude_json_path);
        assert_eq!(initial, unrelated_change);

        write_file(
            &claude_json_path,
            r#"{
              "mcpServers": {
                "github": {
                  "type": "http",
                  "url": "https://example.com/updated"
                }
              }
            }"#,
        );
        let relevant_change = global_mcp_watch_snapshot_from_path(&claude_json_path);
        assert_ne!(initial, relevant_change);
    }

    #[test]
    fn test_project_mcp_snapshot_ignores_other_projects_and_tracks_local_changes() {
        let temp = TempDir::new().unwrap();
        let claude_json_path = temp.path().join(".claude.json");
        let project_root = temp.path().join("project-g");
        let other_root = temp.path().join("project-h");
        let mcp_json_path = project_root.join(".mcp.json");
        fs::create_dir_all(&project_root).unwrap();
        fs::create_dir_all(&other_root).unwrap();

        write_file(
            &claude_json_path,
            &format!(
                r#"{{
                  "projects": {{
                    "{}": {{
                      "enabledMcpjsonServers": ["alpha"]
                    }},
                    "{}": {{
                      "enabledMcpjsonServers": ["other"]
                    }}
                  }}
                }}"#,
                project_root.to_string_lossy().replace('\\', "/"),
                other_root.to_string_lossy().replace('\\', "/")
            ),
        );
        write_file(
            &mcp_json_path,
            r#"{
              "alpha": {
                "command": "node",
                "args": ["alpha.js"]
              }
            }"#,
        );

        let initial =
            project_mcp_watch_snapshot_from_paths(&claude_json_path, &mcp_json_path, &project_root);

        write_file(
            &claude_json_path,
            &format!(
                r#"{{
                  "projects": {{
                    "{}": {{
                      "enabledMcpjsonServers": ["alpha"]
                    }},
                    "{}": {{
                      "enabledMcpjsonServers": ["other", "changed"]
                    }}
                  }}
                }}"#,
                project_root.to_string_lossy().replace('\\', "/"),
                other_root.to_string_lossy().replace('\\', "/")
            ),
        );
        let other_project_change =
            project_mcp_watch_snapshot_from_paths(&claude_json_path, &mcp_json_path, &project_root);
        assert_eq!(initial, other_project_change);

        write_file(
            &mcp_json_path,
            r#"{
              "alpha": {
                "command": "node",
                "args": ["updated.js"]
              }
            }"#,
        );
        let local_change =
            project_mcp_watch_snapshot_from_paths(&claude_json_path, &mcp_json_path, &project_root);
        assert_ne!(initial, local_change);
    }
}

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::models::AgentInfo;
use crate::watcher::WatcherState;

pub struct WatcherSuppressionState {
    pub count: u32,
    pub pending_refresh: bool,
}

/// Helper: decrement suppression count and emit a deferred refresh if needed.
pub async fn unsuppress_and_flush(watcher_state: &WatcherState, app_handle: &tauri::AppHandle) {
    let should_emit = {
        let mut suppression = watcher_state.suppression.lock().await;
        if suppression.count > 0 {
            suppression.count -= 1;
        }
        if suppression.count == 0 && suppression.pending_refresh {
            suppression.pending_refresh = false;
            true
        } else {
            false
        }
    };

    if should_emit {
        let _ = tauri::Emitter::emit(app_handle, "fs-changed", ());
    }
}

pub struct AppState {
    pub agents: Mutex<Vec<AgentInfo>>,
    pub skills: Mutex<Vec<AgentInfo>>,
    pub commands: Mutex<Vec<AgentInfo>>,
    pub global_dir: PathBuf,
    pub active_context: Mutex<String>,
    pub project_dir: Mutex<Option<PathBuf>>,
    pub watcher_state: Arc<WatcherState>,
    /// Serializes read-modify-write operations on setups.json
    pub setups_lock: Mutex<()>,
    /// Serializes read-modify-write operations on MCP-related JSON files
    pub mcp_lock: Mutex<()>,
    /// Tracks canonical paths of files currently being toggled (TOCTOU guard)
    pub toggling_paths: Mutex<HashSet<PathBuf>>,
}

impl AppState {
    pub fn new(global_dir: PathBuf) -> Self {
        Self {
            agents: Mutex::new(Vec::new()),
            skills: Mutex::new(Vec::new()),
            commands: Mutex::new(Vec::new()),
            global_dir,
            active_context: Mutex::new("global".to_string()),
            project_dir: Mutex::new(None),
            watcher_state: Arc::new(WatcherState {
                suppression: Mutex::new(WatcherSuppressionState {
                    count: 0,
                    pending_refresh: false,
                }),
                project_watcher_tx: Mutex::new(None),
            }),
            setups_lock: Mutex::new(()),
            mcp_lock: Mutex::new(()),
            toggling_paths: Mutex::new(HashSet::new()),
        }
    }

    pub async fn begin_suppression(&self) {
        let mut suppression = self.watcher_state.suppression.lock().await;
        suppression.count += 1;
    }

    pub async fn acquire_toggle_paths(&self, paths: &[PathBuf]) -> Result<Vec<PathBuf>, String> {
        let mut unique_paths = Vec::new();
        let mut seen = HashSet::new();

        for path in paths {
            let canonical =
                dunce::canonicalize(path).map_err(|e| format!("Invalid path: {}", e))?;
            if seen.insert(canonical.clone()) {
                unique_paths.push(canonical);
            }
        }

        let mut toggling = self.toggling_paths.lock().await;
        if let Some(path) = unique_paths.iter().find(|path| toggling.contains(*path)) {
            return Err(format!("File is already being toggled: {}", path.display()));
        }

        for path in &unique_paths {
            toggling.insert(path.clone());
        }

        Ok(unique_paths)
    }

    pub async fn release_toggle_paths(&self, paths: &[PathBuf]) {
        let mut toggling = self.toggling_paths.lock().await;
        for path in paths {
            toggling.remove(path);
        }
    }

    /// Resolve the active .claude directory based on current context.
    /// - "global" -> ~/.claude
    /// - "project" -> <project_root>/.claude
    pub async fn active_claude_dir(&self) -> Result<PathBuf, String> {
        let ctx = self.active_context.lock().await;
        match ctx.as_str() {
            "global" => Ok(self.global_dir.clone()),
            "project" => {
                let proj = self.project_dir.lock().await;
                match proj.as_ref() {
                    Some(dir) => Ok(dir.join(".claude")),
                    None => Err("No project selected".into()),
                }
            }
            _ => Err(format!("Unknown context: {}", ctx)),
        }
    }

    /// Get the active context scope label for scanner.
    pub async fn active_scope(&self) -> &'static str {
        let ctx = self.active_context.lock().await;
        match ctx.as_str() {
            "project" => "project",
            _ => "global",
        }
    }

    /// Get the CLAUDE.md target path for the active context.
    /// - "global" -> ~/.claude/CLAUDE.md
    /// - "project" -> <project_root>/CLAUDE.md
    pub async fn active_claude_md_path(&self) -> Result<PathBuf, String> {
        let ctx = self.active_context.lock().await;
        match ctx.as_str() {
            "global" => Ok(self.global_dir.join("CLAUDE.md")),
            "project" => {
                let proj = self.project_dir.lock().await;
                match proj.as_ref() {
                    Some(dir) => Ok(dir.join("CLAUDE.md")),
                    None => Err("No project selected".into()),
                }
            }
            _ => Err(format!("Unknown context: {}", ctx)),
        }
    }

    /// Get the orchestrarium data directory for the active context.
    /// - "global" -> ~/.claude/orchestrarium
    /// - "project" -> <project_root>/.claude/orchestrarium
    pub async fn active_orchestrarium_dir(&self) -> Result<PathBuf, String> {
        let base = self.active_claude_dir().await?;
        Ok(base.join("orchestrarium"))
    }
}

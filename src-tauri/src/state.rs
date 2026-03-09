use std::path::PathBuf;
use std::sync::atomic::AtomicU32;
use std::sync::Arc;

use tokio::sync::Mutex;

use crate::models::AgentInfo;
use crate::watcher::WatcherState;

pub struct AppState {
    pub agents: Mutex<Vec<AgentInfo>>,
    pub skills: Mutex<Vec<AgentInfo>>,
    pub commands: Mutex<Vec<AgentInfo>>,
    pub global_dir: PathBuf,
    pub active_context: Mutex<String>,
    pub project_dir: Mutex<Option<PathBuf>>,
    pub watcher_state: Arc<WatcherState>,
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
                suppress_count: AtomicU32::new(0),
                project_watcher_tx: Mutex::new(None),
            }),
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

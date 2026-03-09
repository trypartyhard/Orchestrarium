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
    pub base_dir: PathBuf,
    pub watcher_state: Arc<WatcherState>,
}

impl AppState {
    pub fn new(base_dir: PathBuf) -> Self {
        Self {
            agents: Mutex::new(Vec::new()),
            skills: Mutex::new(Vec::new()),
            commands: Mutex::new(Vec::new()),
            base_dir,
            watcher_state: Arc::new(WatcherState {
                suppress_count: AtomicU32::new(0),
            }),
        }
    }
}

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::models::AgentInfo;
use crate::toggler;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SetupEntry {
    pub id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Setup {
    pub name: String,
    pub created_at: String,
    pub entries: Vec<SetupEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupsFile {
    pub setups: Vec<Setup>,
    pub active: Option<String>,
}

impl Default for SetupsFile {
    fn default() -> Self {
        Self {
            setups: Vec::new(),
            active: None,
        }
    }
}

pub fn get_setups_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".claude")
        .join("cam")
        .join("setups.json")
}

pub fn load_setups() -> Result<SetupsFile, String> {
    let path = get_setups_path();
    if !path.exists() {
        return Ok(SetupsFile::default());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Read error: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Parse error: {}", e))
}

pub fn save_setups(file: &SetupsFile) -> Result<(), String> {
    let path = get_setups_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    let json = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

pub fn snapshot_current(
    agents: &[AgentInfo],
    skills: &[AgentInfo],
    commands: &[AgentInfo],
) -> Vec<SetupEntry> {
    let mut entries = Vec::new();
    for item in agents.iter().chain(skills.iter()).chain(commands.iter()) {
        entries.push(SetupEntry {
            id: item.id.clone(),
            enabled: item.enabled,
        });
    }
    entries
}

/// Apply setup entries by toggling files to match desired state.
/// Returns a list of error messages for items that failed.
pub fn apply_setup_entries(
    entries: &[SetupEntry],
    base_dir: &Path,
) -> Result<Vec<String>, String> {
    let mut failures = Vec::new();

    // Scan current state for all sections
    let (agents, skills, commands) = crate::scanner::scan_all(base_dir, "global");
    let all_items: Vec<&AgentInfo> = agents.iter().chain(skills.iter()).chain(commands.iter()).collect();

    for entry in entries {
        // Find matching item by id
        if let Some(item) = all_items.iter().find(|i| i.id == entry.id) {
            if item.enabled != entry.enabled {
                let path = PathBuf::from(&item.path);
                if let Err(e) = toggler::toggle(&path, entry.enabled) {
                    failures.push(format!("{}: {}", entry.id, e));
                }
            }
        }
        // Skip items not found (may have been deleted)
    }

    Ok(failures)
}

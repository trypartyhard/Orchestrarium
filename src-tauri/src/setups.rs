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

/// Get the setups.json path for a given .claude base directory.
pub fn get_setups_path(claude_dir: &Path) -> PathBuf {
    claude_dir.join("orchestrarium").join("setups.json")
}

pub fn load_setups_from(claude_dir: &Path) -> Result<SetupsFile, String> {
    let path = get_setups_path(claude_dir);
    if !path.exists() {
        return Ok(SetupsFile::default());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| format!("Read error: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("Parse error: {}", e))
}

pub fn save_setups_to(claude_dir: &Path, file: &SetupsFile) -> Result<(), String> {
    let path = get_setups_path(claude_dir);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Create dir error: {}", e))?;
    }
    let json = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
    // Atomic write: write to temp file, then rename
    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, json).map_err(|e| format!("Write error: {}", e))?;
    std::fs::rename(&tmp_path, &path).map_err(|e| format!("Rename error: {}", e))?;
    Ok(())
}

/// Backward-compatible wrappers that use global ~/.claude dir.
pub fn load_setups() -> Result<SetupsFile, String> {
    let global = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".claude");
    load_setups_from(&global)
}

pub fn save_setups(file: &SetupsFile) -> Result<(), String> {
    let global = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".claude");
    save_setups_to(&global, file)
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
/// Items NOT in the setup are disabled (exclusive activation).
/// Returns a list of error messages for items that failed.
pub fn apply_setup_entries(
    entries: &[SetupEntry],
    base_dir: &Path,
    scope: &str,
) -> Result<Vec<String>, String> {
    let mut failures = Vec::new();

    // Scan current state for all sections
    let (agents, skills, commands) = crate::scanner::scan_all(base_dir, scope);
    let all_items: Vec<&AgentInfo> = agents.iter().chain(skills.iter()).chain(commands.iter()).collect();

    // Build a set of IDs in this setup for quick lookup
    let setup_ids: std::collections::HashSet<&str> = entries.iter().map(|e| e.id.as_str()).collect();

    // 1. Disable all enabled items that are NOT in the setup
    for item in &all_items {
        if item.enabled && !setup_ids.contains(item.id.as_str()) {
            let path = PathBuf::from(&item.path);
            if let Err(e) = toggler::toggle(&path, false) {
                failures.push(format!("{}: {}", item.id, e));
            }
        }
    }

    // 2. Apply setup entries (enable/disable as specified)
    for entry in entries {
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_get_setups_path() {
        let path = get_setups_path(Path::new("/home/user/.claude"));
        assert_eq!(path, PathBuf::from("/home/user/.claude/orchestrarium/setups.json"));
    }

    #[test]
    fn test_load_setups_from_nonexistent_returns_default() {
        let tmp = TempDir::new().unwrap();
        let result = load_setups_from(tmp.path()).unwrap();
        assert!(result.setups.is_empty());
        assert!(result.active.is_none());
    }

    #[test]
    fn test_save_and_load_setups_roundtrip() {
        let tmp = TempDir::new().unwrap();
        let file = SetupsFile {
            setups: vec![Setup {
                name: "test-setup".to_string(),
                created_at: "2025-01-01T00:00:00Z".to_string(),
                entries: vec![
                    SetupEntry { id: "agents/foo".to_string(), enabled: true },
                    SetupEntry { id: "skills/bar".to_string(), enabled: false },
                ],
            }],
            active: Some("test-setup".to_string()),
        };

        save_setups_to(tmp.path(), &file).unwrap();
        let loaded = load_setups_from(tmp.path()).unwrap();

        assert_eq!(loaded.setups.len(), 1);
        assert_eq!(loaded.setups[0].name, "test-setup");
        assert_eq!(loaded.setups[0].entries.len(), 2);
        assert_eq!(loaded.active, Some("test-setup".to_string()));
    }

    #[test]
    fn test_setup_isolation_between_contexts() {
        let global_dir = TempDir::new().unwrap();
        let project_dir = TempDir::new().unwrap();

        // Save a setup in global context
        let global_file = SetupsFile {
            setups: vec![Setup {
                name: "global-setup".to_string(),
                created_at: "2025-01-01T00:00:00Z".to_string(),
                entries: vec![],
            }],
            active: Some("global-setup".to_string()),
        };
        save_setups_to(global_dir.path(), &global_file).unwrap();

        // Save a different setup in project context
        let project_file = SetupsFile {
            setups: vec![Setup {
                name: "project-setup".to_string(),
                created_at: "2025-01-02T00:00:00Z".to_string(),
                entries: vec![],
            }],
            active: Some("project-setup".to_string()),
        };
        save_setups_to(project_dir.path(), &project_file).unwrap();

        // Verify isolation: each context returns only its own setups
        let global_loaded = load_setups_from(global_dir.path()).unwrap();
        assert_eq!(global_loaded.setups.len(), 1);
        assert_eq!(global_loaded.setups[0].name, "global-setup");

        let project_loaded = load_setups_from(project_dir.path()).unwrap();
        assert_eq!(project_loaded.setups.len(), 1);
        assert_eq!(project_loaded.setups[0].name, "project-setup");
    }

    #[test]
    fn test_save_creates_orchestrarium_dir() {
        let tmp = TempDir::new().unwrap();
        let orch_dir = tmp.path().join("orchestrarium");
        assert!(!orch_dir.exists());

        save_setups_to(tmp.path(), &SetupsFile::default()).unwrap();
        assert!(orch_dir.exists());
        assert!(orch_dir.join("setups.json").exists());
    }

    #[test]
    fn test_snapshot_current() {
        let agents = vec![AgentInfo {
            id: "agents/a".to_string(),
            filename: "a.md".to_string(),
            name: "a".to_string(),
            description: None,
            color: None,
            model: None,
            tools: None,
            enabled: true,
            path: "/path/a.md".to_string(),
            section: "agents".to_string(),
            group: String::new(),
            scope: "global".to_string(),
            invalid_config: false,
        }];
        let skills = vec![AgentInfo {
            id: "skills/b".to_string(),
            filename: "b.md".to_string(),
            name: "b".to_string(),
            description: None,
            color: None,
            model: None,
            tools: None,
            enabled: false,
            path: "/path/b.md".to_string(),
            section: "skills".to_string(),
            group: String::new(),
            scope: "global".to_string(),
            invalid_config: false,
        }];
        let commands: Vec<AgentInfo> = vec![];

        let entries = snapshot_current(&agents, &skills, &commands);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].id, "agents/a");
        assert!(entries[0].enabled);
        assert_eq!(entries[1].id, "skills/b");
        assert!(!entries[1].enabled);
    }
}

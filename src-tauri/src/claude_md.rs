use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ClaudeMdProfile {
    pub name: String,
    pub active: bool,
    pub size_bytes: u64,
}

/// Directory where profiles are stored for a given orchestrarium dir.
fn profiles_dir_for(orchestrarium_dir: &Path) -> PathBuf {
    orchestrarium_dir.join("claude-profiles")
}

/// State file tracking which profile is active
fn active_profile_path_for(orchestrarium_dir: &Path) -> PathBuf {
    profiles_dir_for(orchestrarium_dir).join(".active")
}

fn read_active_name_for(orchestrarium_dir: &Path) -> Option<String> {
    let path = active_profile_path_for(orchestrarium_dir);
    if path.exists() {
        std::fs::read_to_string(&path).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
    } else {
        None
    }
}

fn write_active_name_for(orchestrarium_dir: &Path, name: &str) -> Result<(), String> {
    let path = active_profile_path_for(orchestrarium_dir);
    std::fs::write(&path, name).map_err(|e| format!("Failed to write active profile: {}", e))
}

fn clear_active_name_for(orchestrarium_dir: &Path) -> Result<(), String> {
    let path = active_profile_path_for(orchestrarium_dir);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to clear active profile: {}", e))?;
    }
    Ok(())
}

// ─── Global fallback helpers (used by commands that don't have state) ─

fn global_orchestrarium_dir() -> Result<PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".claude")
        .join("orchestrarium"))
}

fn global_claude_md_path() -> Result<PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".claude")
        .join("CLAUDE.md"))
}

// ─── Context-aware public API ─

/// List all saved profiles.
pub fn list_profiles_in(orchestrarium_dir: &Path) -> Result<Vec<ClaudeMdProfile>, String> {
    let dir = profiles_dir_for(orchestrarium_dir);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let active_name = read_active_name_for(orchestrarium_dir);
    let mut profiles = Vec::new();

    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Read dir error: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let meta = std::fs::metadata(&path).map_err(|e| format!("Metadata error: {}", e))?;
            profiles.push(ClaudeMdProfile {
                active: active_name.as_deref() == Some(&name),
                name,
                size_bytes: meta.len(),
            });
        }
    }

    profiles.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(profiles)
}

/// Create a new profile.
pub fn create_profile_in(
    orchestrarium_dir: &Path,
    claude_md_path: &Path,
    name: &str,
    from_current: bool,
) -> Result<(), String> {
    let dir = profiles_dir_for(orchestrarium_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;

    let profile_path = dir.join(format!("{}.md", name));
    if profile_path.exists() {
        return Err(format!("Profile '{}' already exists", name));
    }

    let content = if from_current {
        if claude_md_path.exists() {
            std::fs::read_to_string(claude_md_path).map_err(|e| format!("Read error: {}", e))?
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    std::fs::write(&profile_path, &content).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

/// Activate a profile — copy its content to CLAUDE.md
pub fn activate_profile_in(
    orchestrarium_dir: &Path,
    claude_md_path: &Path,
    name: &str,
) -> Result<(), String> {
    let profile_path = profiles_dir_for(orchestrarium_dir).join(format!("{}.md", name));
    if !profile_path.exists() {
        return Err(format!("Profile '{}' not found", name));
    }

    let content =
        std::fs::read_to_string(&profile_path).map_err(|e| format!("Read error: {}", e))?;
    let claude_tmp = claude_md_path.with_extension("md.tmp");
    std::fs::write(&claude_tmp, &content).map_err(|e| format!("Write error: {}", e))?;
    std::fs::rename(&claude_tmp, claude_md_path).map_err(|e| format!("Rename error: {}", e))?;
    write_active_name_for(orchestrarium_dir, name)?;
    Ok(())
}

/// Deactivate the current profile — clear CLAUDE.md contents but keep the profile.
pub fn deactivate_profile_in(
    orchestrarium_dir: &Path,
    claude_md_path: &Path,
) -> Result<(), String> {
    if claude_md_path.exists() {
        std::fs::write(claude_md_path, "").map_err(|e| format!("Write error: {}", e))?;
    }
    clear_active_name_for(orchestrarium_dir)?;
    Ok(())
}

/// Delete a profile. If active, also clear CLAUDE.md.
pub fn delete_profile_in(
    orchestrarium_dir: &Path,
    claude_md_path: &Path,
    name: &str,
) -> Result<(), String> {
    let profile_path = profiles_dir_for(orchestrarium_dir).join(format!("{}.md", name));
    if !profile_path.exists() {
        return Err(format!("Profile '{}' not found", name));
    }
    std::fs::remove_file(&profile_path).map_err(|e| format!("Delete error: {}", e))?;

    // If this was the active profile, clear CLAUDE.md and active marker
    if read_active_name_for(orchestrarium_dir).as_deref() == Some(name) {
        if claude_md_path.exists() {
            std::fs::write(claude_md_path, "").map_err(|e| format!("Clear CLAUDE.md error: {}", e))?;
        }
        clear_active_name_for(orchestrarium_dir)?;
    }
    Ok(())
}

/// Read profile content.
pub fn read_profile_in(orchestrarium_dir: &Path, name: &str) -> Result<String, String> {
    let profile_path = profiles_dir_for(orchestrarium_dir).join(format!("{}.md", name));
    if !profile_path.exists() {
        return Err(format!("Profile '{}' not found", name));
    }
    std::fs::read_to_string(&profile_path).map_err(|e| format!("Read error: {}", e))
}

/// Save profile content.
pub fn save_profile_in(
    orchestrarium_dir: &Path,
    claude_md_path: &Path,
    name: &str,
    content: &str,
) -> Result<(), String> {
    let dir = profiles_dir_for(orchestrarium_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;

    let profile_path = dir.join(format!("{}.md", name));
    let tmp_path = profile_path.with_extension("md.tmp");
    std::fs::write(&tmp_path, content).map_err(|e| format!("Write error: {}", e))?;
    std::fs::rename(&tmp_path, &profile_path).map_err(|e| format!("Rename error: {}", e))?;

    // If this is the active profile, also update CLAUDE.md
    if read_active_name_for(orchestrarium_dir).as_deref() == Some(name) {
        let claude_tmp = claude_md_path.with_extension("md.tmp");
        std::fs::write(&claude_tmp, content).map_err(|e| format!("Write CLAUDE.md error: {}", e))?;
        std::fs::rename(&claude_tmp, claude_md_path).map_err(|e| format!("Rename CLAUDE.md error: {}", e))?;
    }

    Ok(())
}

/// Rename a profile.
pub fn rename_profile_in(orchestrarium_dir: &Path, old_name: &str, new_name: &str) -> Result<(), String> {
    let dir = profiles_dir_for(orchestrarium_dir);
    let old_path = dir.join(format!("{}.md", old_name));
    let new_path = dir.join(format!("{}.md", new_name));

    if !old_path.exists() {
        return Err(format!("Profile '{}' not found", old_name));
    }
    if new_path.exists() {
        return Err(format!("Profile '{}' already exists", new_name));
    }

    std::fs::rename(&old_path, &new_path).map_err(|e| format!("Rename error: {}", e))?;

    // Update active name if needed
    if read_active_name_for(orchestrarium_dir).as_deref() == Some(old_name) {
        write_active_name_for(orchestrarium_dir, new_name)?;
    }

    Ok(())
}

// ─── Backward-compatible wrappers (global context) ─

pub fn auto_import_if_needed() -> Result<bool, String> {
    let orch_dir = global_orchestrarium_dir()?;
    let dir = profiles_dir_for(&orch_dir);
    // If profiles dir already exists and has .md files, skip
    if dir.exists() {
        let has_profiles = std::fs::read_dir(&dir)
            .map_err(|e| format!("Read dir error: {}", e))?
            .any(|e| {
                e.ok()
                    .and_then(|e| e.path().extension().map(|ext| ext == "md"))
                    .unwrap_or(false)
            });
        if has_profiles {
            return Ok(false);
        }
    }

    let claude_md = global_claude_md_path()?;
    if !claude_md.exists() {
        return Ok(false);
    }

    let content = std::fs::read_to_string(&claude_md).map_err(|e| format!("Read error: {}", e))?;
    if content.trim().is_empty() {
        return Ok(false);
    }

    // Create profiles dir and save as "Default"
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;
    let profile_path = dir.join("Default.md");
    std::fs::write(&profile_path, &content).map_err(|e| format!("Write error: {}", e))?;
    write_active_name_for(&orch_dir, "Default")?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_list_profiles_empty_dir() {
        let tmp = TempDir::new().unwrap();
        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert!(profiles.is_empty());
    }

    #[test]
    fn test_create_and_list_profile() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");

        create_profile_in(tmp.path(), &claude_md, "test-profile", false).unwrap();

        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "test-profile");
        assert!(!profiles[0].active);
    }

    #[test]
    fn test_create_profile_from_current() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");
        std::fs::write(&claude_md, "# My Config").unwrap();

        create_profile_in(tmp.path(), &claude_md, "imported", true).unwrap();

        let content = read_profile_in(tmp.path(), "imported").unwrap();
        assert_eq!(content, "# My Config");
    }

    #[test]
    fn test_create_duplicate_profile_fails() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");

        create_profile_in(tmp.path(), &claude_md, "dup", false).unwrap();
        let result = create_profile_in(tmp.path(), &claude_md, "dup", false);
        assert!(result.is_err());
    }

    #[test]
    fn test_activate_profile_writes_claude_md() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");

        create_profile_in(tmp.path(), &claude_md, "prod", false).unwrap();
        save_profile_in(tmp.path(), &claude_md, "prod", "# Production").unwrap();
        activate_profile_in(tmp.path(), &claude_md, "prod").unwrap();

        assert_eq!(std::fs::read_to_string(&claude_md).unwrap(), "# Production");
        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert!(profiles[0].active);
    }

    #[test]
    fn test_deactivate_clears_claude_md() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");
        std::fs::write(&claude_md, "content").unwrap();

        create_profile_in(tmp.path(), &claude_md, "test", false).unwrap();
        activate_profile_in(tmp.path(), &claude_md, "test").unwrap();
        deactivate_profile_in(tmp.path(), &claude_md).unwrap();

        assert_eq!(std::fs::read_to_string(&claude_md).unwrap(), "");
        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert!(!profiles[0].active);
    }

    #[test]
    fn test_delete_active_profile_clears_claude_md() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");

        create_profile_in(tmp.path(), &claude_md, "del-me", false).unwrap();
        save_profile_in(tmp.path(), &claude_md, "del-me", "# Delete me").unwrap();
        activate_profile_in(tmp.path(), &claude_md, "del-me").unwrap();
        delete_profile_in(tmp.path(), &claude_md, "del-me").unwrap();

        assert_eq!(std::fs::read_to_string(&claude_md).unwrap(), "");
        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert!(profiles.is_empty());
    }

    #[test]
    fn test_rename_profile() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");

        create_profile_in(tmp.path(), &claude_md, "old-name", false).unwrap();
        rename_profile_in(tmp.path(), "old-name", "new-name").unwrap();

        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].name, "new-name");
    }

    #[test]
    fn test_rename_active_profile_updates_active_name() {
        let tmp = TempDir::new().unwrap();
        let claude_md = tmp.path().join("CLAUDE.md");

        create_profile_in(tmp.path(), &claude_md, "active-one", false).unwrap();
        activate_profile_in(tmp.path(), &claude_md, "active-one").unwrap();
        rename_profile_in(tmp.path(), "active-one", "renamed").unwrap();

        let profiles = list_profiles_in(tmp.path()).unwrap();
        assert_eq!(profiles[0].name, "renamed");
        assert!(profiles[0].active);
    }

    #[test]
    fn test_profile_isolation_between_contexts() {
        let global = TempDir::new().unwrap();
        let project = TempDir::new().unwrap();
        let global_md = global.path().join("CLAUDE.md");
        let project_md = project.path().join("CLAUDE.md");

        create_profile_in(global.path(), &global_md, "global-prof", false).unwrap();
        create_profile_in(project.path(), &project_md, "project-prof", false).unwrap();

        let global_profiles = list_profiles_in(global.path()).unwrap();
        let project_profiles = list_profiles_in(project.path()).unwrap();

        assert_eq!(global_profiles.len(), 1);
        assert_eq!(global_profiles[0].name, "global-prof");
        assert_eq!(project_profiles.len(), 1);
        assert_eq!(project_profiles[0].name, "project-prof");
    }
}

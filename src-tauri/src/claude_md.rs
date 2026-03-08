use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ClaudeMdProfile {
    pub name: String,
    pub active: bool,
    pub size_bytes: u64,
}

/// Directory where profiles are stored.
fn profiles_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".claude")
        .join("orchestrarium")
        .join("claude-profiles")
}

/// Path to the real CLAUDE.md
fn claude_md_path() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".claude")
        .join("CLAUDE.md")
}

/// State file tracking which profile is active
fn active_profile_path() -> PathBuf {
    profiles_dir().join(".active")
}

fn read_active_name() -> Option<String> {
    let path = active_profile_path();
    if path.exists() {
        std::fs::read_to_string(&path).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
    } else {
        None
    }
}

fn write_active_name(name: &str) -> Result<(), String> {
    let path = active_profile_path();
    std::fs::write(&path, name).map_err(|e| format!("Failed to write active profile: {}", e))
}

fn clear_active_name() -> Result<(), String> {
    let path = active_profile_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to clear active profile: {}", e))?;
    }
    Ok(())
}

/// List all saved profiles.
pub fn list_profiles() -> Result<Vec<ClaudeMdProfile>, String> {
    let dir = profiles_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let active_name = read_active_name();
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

/// Create a new profile. If from_current is true, copies current CLAUDE.md content.
pub fn create_profile(name: &str, from_current: bool) -> Result<(), String> {
    let dir = profiles_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;

    let profile_path = dir.join(format!("{}.md", name));
    if profile_path.exists() {
        return Err(format!("Profile '{}' already exists", name));
    }

    let content = if from_current {
        let claude_md = claude_md_path();
        if claude_md.exists() {
            std::fs::read_to_string(&claude_md).map_err(|e| format!("Read error: {}", e))?
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
pub fn activate_profile(name: &str) -> Result<(), String> {
    let profile_path = profiles_dir().join(format!("{}.md", name));
    if !profile_path.exists() {
        return Err(format!("Profile '{}' not found", name));
    }

    let content =
        std::fs::read_to_string(&profile_path).map_err(|e| format!("Read error: {}", e))?;
    std::fs::write(claude_md_path(), &content).map_err(|e| format!("Write error: {}", e))?;
    write_active_name(name)?;
    Ok(())
}

/// Deactivate the current profile — clear CLAUDE.md contents but keep the profile.
pub fn deactivate_profile() -> Result<(), String> {
    let claude_md = claude_md_path();
    if claude_md.exists() {
        std::fs::write(&claude_md, "").map_err(|e| format!("Write error: {}", e))?;
    }
    clear_active_name()?;
    Ok(())
}

/// Delete a profile. If active, also clear CLAUDE.md.
pub fn delete_profile(name: &str) -> Result<(), String> {
    let profile_path = profiles_dir().join(format!("{}.md", name));
    if !profile_path.exists() {
        return Err(format!("Profile '{}' not found", name));
    }
    std::fs::remove_file(&profile_path).map_err(|e| format!("Delete error: {}", e))?;

    // If this was the active profile, clear CLAUDE.md and active marker
    if read_active_name().as_deref() == Some(name) {
        let claude_md = claude_md_path();
        if claude_md.exists() {
            std::fs::write(&claude_md, "").map_err(|e| format!("Clear CLAUDE.md error: {}", e))?;
        }
        clear_active_name()?;
    }
    Ok(())
}

/// Read profile content.
pub fn read_profile(name: &str) -> Result<String, String> {
    let profile_path = profiles_dir().join(format!("{}.md", name));
    if !profile_path.exists() {
        return Err(format!("Profile '{}' not found", name));
    }
    std::fs::read_to_string(&profile_path).map_err(|e| format!("Read error: {}", e))
}

/// Save profile content.
pub fn save_profile(name: &str, content: &str) -> Result<(), String> {
    let dir = profiles_dir();
    std::fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;

    let profile_path = dir.join(format!("{}.md", name));
    std::fs::write(&profile_path, content).map_err(|e| format!("Write error: {}", e))?;

    // If this is the active profile, also update CLAUDE.md
    if read_active_name().as_deref() == Some(name) {
        std::fs::write(claude_md_path(), content).map_err(|e| format!("Write CLAUDE.md error: {}", e))?;
    }

    Ok(())
}

/// Auto-import existing CLAUDE.md on first run if no profiles exist yet.
pub fn auto_import_if_needed() -> Result<bool, String> {
    let dir = profiles_dir();
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

    let claude_md = claude_md_path();
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
    write_active_name("Default")?;

    Ok(true)
}

/// Rename a profile.
pub fn rename_profile(old_name: &str, new_name: &str) -> Result<(), String> {
    let dir = profiles_dir();
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
    if read_active_name().as_deref() == Some(old_name) {
        write_active_name(new_name)?;
    }

    Ok(())
}

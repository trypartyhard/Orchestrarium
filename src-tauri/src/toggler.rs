use std::fs;
use std::path::{Path, PathBuf};

/// Toggle an agent file's enabled state.
/// - disable: move from `dir/file.md` to `dir/.disabled/file.md`
/// - enable: move from `dir/.disabled/file.md` to `dir/../file.md` (parent of .disabled)
pub fn toggle(path: &Path, enable: bool) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    let filename = path.file_name().ok_or("No filename")?;
    let parent = path.parent().ok_or("No parent dir")?;
    let parent_name = parent.file_name().and_then(|n| n.to_str());
    let in_disabled = parent_name == Some(".disabled");

    let target = if enable {
        if !in_disabled {
            return Err("File is already enabled".into());
        }
        // Move from .disabled/ to parent's parent
        let grandparent = parent.parent().ok_or("No grandparent dir")?;
        grandparent.join(filename)
    } else {
        if in_disabled {
            return Err("File is already disabled".into());
        }
        // Move to .disabled/ subdir
        let disabled_dir = parent.join(".disabled");
        fs::create_dir_all(&disabled_dir)
            .map_err(|e| format!("Failed to create .disabled/: {}", e))?;
        disabled_dir.join(filename)
    };

    // If destination already exists (e.g. duplicate from plugins), overwrite it
    if target.exists() {
        fs::remove_file(&target)
            .map_err(|e| format!("Failed to remove existing {}: {}", target.display(), e))?;
    }

    fs::rename(path, &target).map_err(|e| format!("Failed to move file: {}", e))?;

    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_disable_moves_to_disabled_dir() {
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("agent.md");
        fs::write(&file, "content").unwrap();

        let result = toggle(&file, false).unwrap();
        assert_eq!(result, tmp.path().join(".disabled").join("agent.md"));
        assert!(result.exists());
        assert!(!file.exists());
    }

    #[test]
    fn test_enable_moves_from_disabled_dir() {
        let tmp = TempDir::new().unwrap();
        let disabled_dir = tmp.path().join(".disabled");
        fs::create_dir_all(&disabled_dir).unwrap();
        let file = disabled_dir.join("agent.md");
        fs::write(&file, "content").unwrap();

        let result = toggle(&file, true).unwrap();
        assert_eq!(result, tmp.path().join("agent.md"));
        assert!(result.exists());
        assert!(!file.exists());
    }

    #[test]
    fn test_disable_creates_disabled_dir() {
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("agent.md");
        fs::write(&file, "content").unwrap();
        assert!(!tmp.path().join(".disabled").exists());

        toggle(&file, false).unwrap();
        assert!(tmp.path().join(".disabled").exists());
    }

    #[test]
    fn test_nonexistent_file_returns_error() {
        let result = toggle(Path::new("/tmp/nonexistent-12345.md"), false);
        assert!(result.is_err());
    }

    #[test]
    fn test_toggle_preserves_content() {
        let tmp = TempDir::new().unwrap();
        let file = tmp.path().join("agent.md");
        let content = "---\nname: Test\n---\nBody";
        fs::write(&file, content).unwrap();

        let disabled = toggle(&file, false).unwrap();
        assert_eq!(fs::read_to_string(&disabled).unwrap(), content);

        let enabled = toggle(&disabled, true).unwrap();
        assert_eq!(fs::read_to_string(&enabled).unwrap(), content);
    }
}

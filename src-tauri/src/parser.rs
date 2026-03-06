use std::path::Path;

use gray_matter::engine::YAML;
use gray_matter::{Matter, Pod};
use std::collections::HashMap;

use crate::models::AgentInfo;

fn pod_as_string(pod: &Pod) -> Option<String> {
    pod.as_string().ok()
}

fn parse_tools_from_pod(pod: &Pod) -> Option<Vec<String>> {
    match pod {
        Pod::String(s) => Some(s.split(", ").map(|t| t.trim().to_string()).collect()),
        Pod::Array(arr) => Some(arr.iter().filter_map(|p| pod_as_string(p)).collect()),
        _ => None,
    }
}

fn get_field(map: &HashMap<String, Pod>, key: &str) -> Option<Pod> {
    map.get(key).cloned()
}

pub fn parse_agent_file(path: &Path, section: &str, enabled: bool, scope: &str) -> AgentInfo {
    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let stem = filename.trim_end_matches(".md");
    let id = format!("{}/{}", section, filename);

    let make_fallback = |invalid: bool| AgentInfo {
        id: id.clone(),
        filename: filename.clone(),
        name: stem.to_string(),
        description: None,
        color: None,
        model: None,
        tools: None,
        enabled,
        path: path.to_string_lossy().to_string(),
        section: section.to_string(),
        group: String::new(),
        scope: scope.to_string(),
        invalid_config: invalid,
    };

    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return make_fallback(true),
    };

    let matter = Matter::<YAML>::new();
    let parsed: gray_matter::ParsedEntity = match matter.parse(&content) {
        Ok(p) => p,
        Err(_) => return make_fallback(false),
    };

    let map = match parsed.data {
        Some(ref pod) => match pod.as_hashmap() {
            Ok(m) => m,
            Err(_) => return make_fallback(false),
        },
        None => return make_fallback(false),
    };

    let name = get_field(&map, "name").and_then(|p| pod_as_string(&p));
    let description = get_field(&map, "description").and_then(|p| pod_as_string(&p));
    let color = get_field(&map, "color").and_then(|p| pod_as_string(&p));
    let model = get_field(&map, "model").and_then(|p| pod_as_string(&p));
    let tools = get_field(&map, "tools").and_then(|p| parse_tools_from_pod(&p));

    AgentInfo {
        id,
        filename: filename.clone(),
        name: name.unwrap_or_else(|| stem.to_string()),
        description,
        color,
        model,
        tools,
        enabled,
        path: path.to_string_lossy().to_string(),
        section: section.to_string(),
        group: String::new(),
        scope: scope.to_string(),
        invalid_config: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_file(dir: &TempDir, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.path().join(name);
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn test_valid_frontmatter_all_fields() {
        let dir = TempDir::new().unwrap();
        let path = write_file(
            &dir,
            "test-agent.md",
            "---\nname: Test Agent\ndescription: A test agent\ncolor: \"#ff0000\"\nmodel: opus\ntools: Read, Write\n---\nBody content",
        );
        let info = parse_agent_file(&path, "agents", true, "global");
        assert_eq!(info.name, "Test Agent");
        assert_eq!(info.description.as_deref(), Some("A test agent"));
        assert_eq!(info.color.as_deref(), Some("#ff0000"));
        assert_eq!(info.model.as_deref(), Some("opus"));
        assert_eq!(info.tools, Some(vec!["Read".to_string(), "Write".to_string()]));
        assert!(info.enabled);
        assert!(!info.invalid_config);
        assert_eq!(info.scope, "global");
    }

    #[test]
    fn test_missing_fields_returns_defaults() {
        let dir = TempDir::new().unwrap();
        let path = write_file(&dir, "my-agent.md", "---\nname: Just Name\n---\n");
        let info = parse_agent_file(&path, "agents", true, "global");
        assert_eq!(info.name, "Just Name");
        assert!(info.description.is_none());
        assert!(info.color.is_none());
        assert!(info.model.is_none());
        assert!(info.tools.is_none());
        assert!(!info.invalid_config);
    }

    #[test]
    fn test_no_frontmatter_fallback() {
        let dir = TempDir::new().unwrap();
        let path = write_file(&dir, "bare.md", "No frontmatter here, just text.");
        let info = parse_agent_file(&path, "agents", true, "global");
        assert_eq!(info.name, "bare");
        assert!(!info.invalid_config); // gray_matter returns empty data, not an error
    }

    #[test]
    fn test_malformed_yaml_no_panic() {
        let dir = TempDir::new().unwrap();
        let path = write_file(&dir, "bad.md", "---\nname: \"unclosed\n  broken: [yaml\n---\n");
        let info = parse_agent_file(&path, "skills", false, "project");
        // Should not panic, name falls back to filename stem
        assert_eq!(info.name, "bad");
        assert_eq!(info.section, "skills");
        assert!(!info.enabled);
        assert_eq!(info.scope, "project");
    }

    #[test]
    fn test_tools_as_array() {
        let dir = TempDir::new().unwrap();
        let path = write_file(
            &dir,
            "arr.md",
            "---\ntools:\n  - Read\n  - Write\n  - Bash\n---\n",
        );
        let info = parse_agent_file(&path, "agents", true, "global");
        assert_eq!(
            info.tools,
            Some(vec!["Read".to_string(), "Write".to_string(), "Bash".to_string()])
        );
    }

    #[test]
    fn test_tools_as_string() {
        let dir = TempDir::new().unwrap();
        let path = write_file(&dir, "str.md", "---\ntools: Read, Write\n---\n");
        let info = parse_agent_file(&path, "agents", true, "global");
        assert_eq!(
            info.tools,
            Some(vec!["Read".to_string(), "Write".to_string()])
        );
    }

    #[test]
    fn test_description_with_colons() {
        let dir = TempDir::new().unwrap();
        let path = write_file(
            &dir,
            "colon.md",
            "---\ndescription: \"Do X: then Y: finally Z\"\n---\n",
        );
        let info = parse_agent_file(&path, "agents", true, "global");
        assert_eq!(
            info.description.as_deref(),
            Some("Do X: then Y: finally Z")
        );
    }

    #[test]
    fn test_id_format() {
        let dir = TempDir::new().unwrap();
        let path = write_file(&dir, "my-agent.md", "---\nname: Test\n---\n");
        let info = parse_agent_file(&path, "commands", true, "global");
        assert_eq!(info.id, "commands/my-agent.md");
        assert_eq!(info.section, "commands");
    }

    #[test]
    fn test_nonexistent_file() {
        let path = Path::new("/tmp/does-not-exist-12345.md");
        let info = parse_agent_file(path, "agents", true, "global");
        assert!(info.invalid_config);
        assert_eq!(info.name, "does-not-exist-12345");
    }
}

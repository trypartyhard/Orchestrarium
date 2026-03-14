use std::path::Path;

use crate::groups;
use crate::models::AgentInfo;
use crate::parser;

/// Scan a section directory for .md files.
/// Looks in `{base_dir}/{section}/` for enabled files
/// and `{base_dir}/{section}/.disabled/` for disabled files.
pub fn scan_section(base_dir: &Path, section: &str, scope: &str) -> Vec<AgentInfo> {
    let mut agents = Vec::new();
    let section_dir = base_dir.join(section);

    // Scan enabled files
    scan_dir(&section_dir, section, true, scope, &mut agents);

    // Scan disabled files
    let disabled_dir = section_dir.join(".disabled");
    scan_dir(&disabled_dir, section, false, scope, &mut agents);

    // Deduplicate: if same filename exists enabled + disabled, keep enabled, warn about dupe
    let mut seen = std::collections::HashMap::<String, usize>::new();
    let mut to_remove = Vec::new();
    for (i, agent) in agents.iter().enumerate() {
        if let Some(&prev_idx) = seen.get(&agent.filename) {
            // Duplicate found — keep the enabled one
            if agent.enabled && !agents[prev_idx].enabled {
                to_remove.push(prev_idx);
                seen.insert(agent.filename.clone(), i);
            } else {
                to_remove.push(i);
            }
            eprintln!(
                "Warning: duplicate file '{}' found in both enabled and disabled for {}/{}",
                agent.filename, scope, section
            );
        } else {
            seen.insert(agent.filename.clone(), i);
        }
    }
    // Remove duplicates in reverse order to preserve indices
    to_remove.sort_unstable();
    to_remove.dedup();
    for idx in to_remove.into_iter().rev() {
        agents.remove(idx);
    }

    groups::assign_groups(&mut agents);
    agents
}

fn scan_dir(dir: &Path, section: &str, enabled: bool, scope: &str, agents: &mut Vec<AgentInfo>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries {
        match entry {
            Ok(e) => {
                let path = e.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext == "md" {
                            let agent = parser::parse_agent_file(&path, section, enabled, scope);
                            agents.push(agent);
                        }
                    }
                }
            }
            Err(err) => {
                eprintln!("Warning: failed to read entry in {}: {}", dir.display(), err);
            }
        }
    }
}

/// Scan all three sections.
pub fn scan_all(base_dir: &Path, scope: &str) -> (Vec<AgentInfo>, Vec<AgentInfo>, Vec<AgentInfo>) {
    let agents = scan_section(base_dir, "agents", scope);
    let skills = scan_section(base_dir, "skills", scope);
    let commands = scan_section(base_dir, "commands", scope);
    (agents, skills, commands)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_section(base: &Path, section: &str, files: &[(&str, &str)]) {
        let dir = base.join(section);
        fs::create_dir_all(&dir).unwrap();
        for (name, content) in files {
            fs::write(dir.join(name), content).unwrap();
        }
    }

    fn setup_disabled(base: &Path, section: &str, files: &[(&str, &str)]) {
        let dir = base.join(section).join(".disabled");
        fs::create_dir_all(&dir).unwrap();
        for (name, content) in files {
            fs::write(dir.join(name), content).unwrap();
        }
    }

    #[test]
    fn test_scan_finds_md_files() {
        let tmp = TempDir::new().unwrap();
        setup_section(
            tmp.path(),
            "agents",
            &[
                ("agent1.md", "---\nname: Agent 1\n---\n"),
                ("agent2.md", "---\nname: Agent 2\n---\n"),
            ],
        );
        let result = scan_section(tmp.path(), "agents", "global");
        assert_eq!(result.len(), 2);
        assert!(result.iter().all(|a| a.enabled));
        assert!(result.iter().all(|a| a.scope == "global"));
    }

    #[test]
    fn test_scan_finds_disabled_files() {
        let tmp = TempDir::new().unwrap();
        setup_section(tmp.path(), "agents", &[("active.md", "---\nname: Active\n---\n")]);
        setup_disabled(
            tmp.path(),
            "agents",
            &[("disabled.md", "---\nname: Disabled\n---\n")],
        );
        let result = scan_section(tmp.path(), "agents", "global");
        assert_eq!(result.len(), 2);
        let enabled: Vec<_> = result.iter().filter(|a| a.enabled).collect();
        let disabled: Vec<_> = result.iter().filter(|a| !a.enabled).collect();
        assert_eq!(enabled.len(), 1);
        assert_eq!(disabled.len(), 1);
    }

    #[test]
    fn test_scan_skips_non_md() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().join("agents");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("agent.md"), "---\nname: Agent\n---\n").unwrap();
        fs::write(dir.join("readme.txt"), "not an agent").unwrap();
        fs::write(dir.join("config.json"), "{}").unwrap();
        let result = scan_section(tmp.path(), "agents", "global");
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_scan_missing_directory() {
        let tmp = TempDir::new().unwrap();
        let result = scan_section(tmp.path(), "nonexistent", "global");
        assert!(result.is_empty());
    }

    #[test]
    fn test_scan_all_three_sections() {
        let tmp = TempDir::new().unwrap();
        setup_section(tmp.path(), "agents", &[("a.md", "---\nname: A\n---\n")]);
        setup_section(
            tmp.path(),
            "skills",
            &[
                ("s1.md", "---\nname: S1\n---\n"),
                ("s2.md", "---\nname: S2\n---\n"),
            ],
        );
        setup_section(tmp.path(), "commands", &[("c.md", "---\nname: C\n---\n")]);
        let (agents, skills, commands) = scan_all(tmp.path(), "global");
        assert_eq!(agents.len(), 1);
        assert_eq!(skills.len(), 2);
        assert_eq!(commands.len(), 1);
    }
}

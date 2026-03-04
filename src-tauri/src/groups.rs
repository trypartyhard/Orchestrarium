use crate::models::AgentInfo;
use std::collections::HashMap;

/// Extract group prefix from filename.
/// "gsd-planner.md" -> "gsd"
/// "standalone.md" -> "custom"
pub fn extract_prefix(filename: &str) -> String {
    let stem = filename.trim_end_matches(".md");
    match stem.split('-').next() {
        Some(prefix) if prefix != stem => prefix.to_lowercase(),
        _ => "custom".to_string(),
    }
}

/// Assign group names to agents. Prefixes shared by 2+ agents become groups.
/// Single-occurrence prefixes get reassigned to "Custom".
pub fn assign_groups(agents: &mut Vec<AgentInfo>) {
    // Count occurrences of each prefix
    let mut counts: HashMap<String, usize> = HashMap::new();
    for agent in agents.iter() {
        let prefix = extract_prefix(&agent.filename);
        *counts.entry(prefix).or_insert(0) += 1;
    }

    // Assign group: prefix uppercase if shared, "Custom" otherwise
    for agent in agents.iter_mut() {
        let prefix = extract_prefix(&agent.filename);
        if counts.get(&prefix).copied().unwrap_or(0) >= 2 {
            agent.group = prefix.to_uppercase();
        } else {
            agent.group = "Custom".to_string();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_prefix_with_dash() {
        assert_eq!(extract_prefix("gsd-planner.md"), "gsd");
        assert_eq!(extract_prefix("gsd-executor.md"), "gsd");
    }

    #[test]
    fn test_extract_prefix_no_dash() {
        assert_eq!(extract_prefix("standalone.md"), "custom");
    }

    #[test]
    fn test_extract_prefix_single_char() {
        assert_eq!(extract_prefix("a-thing.md"), "a");
    }

    fn make_agent(filename: &str) -> AgentInfo {
        AgentInfo {
            id: format!("agents/{}", filename),
            filename: filename.to_string(),
            name: filename.to_string(),
            description: None,
            color: None,
            model: None,
            tools: None,
            enabled: true,
            path: String::new(),
            section: "agents".to_string(),
            group: String::new(),
            invalid_config: false,
        }
    }

    #[test]
    fn test_assign_groups_shared_prefix() {
        let mut agents = vec![
            make_agent("gsd-planner.md"),
            make_agent("gsd-executor.md"),
            make_agent("gsd-verifier.md"),
        ];
        assign_groups(&mut agents);
        assert!(agents.iter().all(|a| a.group == "GSD"));
    }

    #[test]
    fn test_assign_groups_unique_prefix_becomes_custom() {
        let mut agents = vec![
            make_agent("gsd-planner.md"),
            make_agent("gsd-executor.md"),
            make_agent("lonely-agent.md"),
        ];
        assign_groups(&mut agents);
        assert_eq!(agents[0].group, "GSD");
        assert_eq!(agents[1].group, "GSD");
        assert_eq!(agents[2].group, "Custom");
    }

    #[test]
    fn test_assign_groups_all_custom() {
        let mut agents = vec![
            make_agent("alpha-one.md"),
            make_agent("beta-two.md"),
            make_agent("gamma-three.md"),
        ];
        assign_groups(&mut agents);
        assert!(agents.iter().all(|a| a.group == "Custom"));
    }

    #[test]
    fn test_assign_groups_no_dash_files() {
        let mut agents = vec![make_agent("standalone.md"), make_agent("another.md")];
        assign_groups(&mut agents);
        // Both are "custom" prefix, shared by 2 → "CUSTOM"
        assert!(agents.iter().all(|a| a.group == "CUSTOM"));
    }
}

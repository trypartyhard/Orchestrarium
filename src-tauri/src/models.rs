use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AgentInfo {
    pub id: String,
    pub filename: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub model: Option<String>,
    pub tools: Option<Vec<String>>,
    pub enabled: bool,
    pub path: String,
    pub section: String,
    pub group: String,
    pub invalid_config: bool,
}

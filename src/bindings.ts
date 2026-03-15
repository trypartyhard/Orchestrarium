// Manual bindings — kept in sync with src-tauri/src/commands.rs
// tauri-specta auto-generation is disabled to preserve this simple invoke-based format.

import { invoke } from "@tauri-apps/api/core";

// ─── Context commands ───────────────────────────────────────────

export type ContextType = "global" | "project";
export type SectionType = "agents" | "skills" | "commands";

export async function setActiveContext(context: ContextType): Promise<void> {
  return await invoke<void>("set_active_context", { context });
}

export async function getActiveContext(): Promise<ContextType> {
  return await invoke<ContextType>("get_active_context");
}

export async function setProjectDir(path: string | null): Promise<void> {
  return await invoke<void>("set_project_dir", { path });
}

export async function getProjectDir(): Promise<string | null> {
  return await invoke<string | null>("get_project_dir");
}

// ─── Types ──────────────────────────────────────────────────────

export type AgentInfo = {
  id: string;
  filename: string;
  name: string;
  description: string | null;
  color: string | null;
  model: string | null;
  tools: string[] | null;
  enabled: boolean;
  path: string;
  section: string;
  group: string;
  scope: string;
  invalid_config: boolean;
};

export type SetupEntry = {
  id: string;
  enabled: boolean;
};

export type Setup = {
  name: string;
  created_at: string;
  entries: SetupEntry[];
};

export type McpServerType = "command" | "http" | "sse";
export type McpServerSource = "claudeJson" | "mcpJson";
export type McpScope = "global" | "project";

export type McpServerSummary = {
  id: string;
  name: string;
  source: McpServerSource;
  scope: McpScope;
  enabled: boolean;
  serverType: McpServerType;
  projectPath: string | null;
  canToggle: boolean;
  canEdit: boolean;
  redactedPreview: string;
};

export type EditableMcpServer = {
  id: string;
  name: string;
  serverType: McpServerType;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
};

export type CreateMcpServerInput = {
  name: string;
  serverType: McpServerType;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
};

export type UpdateMcpServerInput = {
  id: string;
  serverType: McpServerType;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
};

export async function getAgents(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_agents");
}

export async function getSkills(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_skills");
}

export async function getCommands(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_commands");
}

export async function getMcpServers(): Promise<McpServerSummary[]> {
  return await invoke<McpServerSummary[]>("get_mcp_servers");
}

export async function getMcpServerDetail(id: string): Promise<EditableMcpServer> {
  return await invoke<EditableMcpServer>("get_mcp_server_detail", { id });
}

export async function toggleMcpServer(
  id: string,
  enable: boolean,
): Promise<McpServerSummary> {
  return await invoke<McpServerSummary>("toggle_mcp_server", { id, enable });
}

export async function createMcpServer(
  input: CreateMcpServerInput,
): Promise<McpServerSummary> {
  return await invoke<McpServerSummary>("create_mcp_server", { input });
}

export async function updateMcpServer(
  input: UpdateMcpServerInput,
): Promise<McpServerSummary> {
  return await invoke<McpServerSummary>("update_mcp_server", { input });
}

export async function deleteMcpServer(id: string): Promise<void> {
  return await invoke<void>("delete_mcp_server", { id });
}

export type McpProfileHealth = "ok" | "drift" | "conflict" | "broken";
export type McpProfileIssueKind = "drift" | "conflict" | "broken";

export type McpProfileIssue = {
  kind: McpProfileIssueKind;
  message: string;
  blocking: boolean;
};

export type McpProfileSummary = {
  name: string;
  active: boolean;
  serverCount: number;
  healthStatus: McpProfileHealth;
  serverTypes: McpServerType[];
};

export type McpProfileDetail = {
  name: string;
  active: boolean;
  serverCount: number;
  healthStatus: McpProfileHealth;
  serverTypes: McpServerType[];
  content: string;
};

export type McpProfileActivationPreview = {
  profileName: string;
  serverCount: number;
  canActivate: boolean;
  collisions: string[];
  issues: McpProfileIssue[];
};

export async function listMcpProfiles(): Promise<McpProfileSummary[]> {
  return await invoke<McpProfileSummary[]>("list_mcp_profiles");
}

export async function readMcpProfile(name: string): Promise<McpProfileDetail> {
  return await invoke<McpProfileDetail>("read_mcp_profile", { name });
}

export async function createMcpProfile(name: string): Promise<McpProfileDetail> {
  return await invoke<McpProfileDetail>("create_mcp_profile", { name });
}

export async function saveMcpProfile(
  name: string,
  content: string,
): Promise<McpProfileDetail> {
  return await invoke<McpProfileDetail>("save_mcp_profile", { name, content });
}

export async function deleteMcpProfile(name: string): Promise<void> {
  return await invoke<void>("delete_mcp_profile", { name });
}

export async function previewActivateMcpProfile(
  name: string,
): Promise<McpProfileActivationPreview> {
  return await invoke<McpProfileActivationPreview>("preview_activate_mcp_profile", { name });
}

export async function activateMcpProfile(name: string): Promise<void> {
  return await invoke<void>("activate_mcp_profile", { name });
}

export async function deactivateMcpProfile(): Promise<void> {
  return await invoke<void>("deactivate_mcp_profile");
}

export async function toggleItem(
  path: string,
  enable: boolean,
  section: SectionType,
): Promise<AgentInfo> {
  return await invoke<AgentInfo>("toggle_item", { path, enable, section });
}

export type ToggleBatchItem = {
  path: string;
  enable: boolean;
};

export async function toggleBatch(
  items: ToggleBatchItem[],
): Promise<string[]> {
  return await invoke<string[]>("toggle_batch", { items });
}

export async function frontendReady(): Promise<void> {
  return await invoke<void>("frontend_ready");
}

export async function getSetups(): Promise<Setup[]> {
  return await invoke<Setup[]>("get_setups");
}

export async function getActiveSetup(): Promise<string | null> {
  return await invoke<string | null>("get_active_setup");
}

export async function clearActiveSetup(): Promise<void> {
  return await invoke<void>("clear_active_setup");
}

export async function createSetup(name: string, itemIds: string[]): Promise<Setup> {
  return await invoke<Setup>("create_setup", { name, itemIds });
}

export async function deleteSetup(name: string): Promise<void> {
  return await invoke<void>("delete_setup", { name });
}

export async function applySetup(name: string): Promise<string[]> {
  return await invoke<string[]>("apply_setup", { name });
}

export async function exportSetup(name: string): Promise<string> {
  return await invoke<string>("export_setup", { name });
}

export async function importSetup(json: string): Promise<Setup> {
  return await invoke<Setup>("import_setup", { json });
}

// ─── Setup file I/O via backend-owned dialogs ─

export async function saveSetupFileWithDialog(
  suggestedName: string,
  content: string,
): Promise<boolean> {
  return await invoke<boolean>("save_setup_file_with_dialog", { suggestedName, content });
}

export async function readSetupFileWithDialog(): Promise<string | null> {
  return await invoke<string | null>("read_setup_file_with_dialog");
}

// ─── File preview ───────────────────────────────────────────────

export async function readItemContent(path: string): Promise<string> {
  return await invoke<string>("read_item_content", { path });
}

export async function copyItemToProject(sourcePath: string, section: SectionType): Promise<AgentInfo> {
  return await invoke<AgentInfo>("copy_item_to_project", { sourcePath, section });
}

// ─── CLAUDE.md profile bindings ─────────────────────────────────

export type ClaudeMdProfile = {
  name: string;
  active: boolean;
  size_bytes: number;
};

export async function autoImportClaudeMd(): Promise<boolean> {
  return await invoke<boolean>("auto_import_claude_md");
}

export async function listClaudeProfiles(): Promise<ClaudeMdProfile[]> {
  return await invoke<ClaudeMdProfile[]>("list_claude_profiles");
}

export async function createClaudeProfile(name: string, fromCurrent: boolean): Promise<void> {
  return await invoke<void>("create_claude_profile", { name, fromCurrent });
}

export async function activateClaudeProfile(name: string): Promise<void> {
  return await invoke<void>("activate_claude_profile", { name });
}

export async function deactivateClaudeProfile(): Promise<void> {
  return await invoke<void>("deactivate_claude_profile");
}

export async function deleteClaudeProfile(name: string): Promise<void> {
  return await invoke<void>("delete_claude_profile", { name });
}

export async function readClaudeProfile(name: string): Promise<string> {
  return await invoke<string>("read_claude_profile", { name });
}

export async function saveClaudeProfile(name: string, content: string): Promise<void> {
  return await invoke<void>("save_claude_profile", { name, content });
}

export async function renameClaudeProfile(oldName: string, newName: string): Promise<void> {
  return await invoke<void>("rename_claude_profile", { oldName, newName });
}

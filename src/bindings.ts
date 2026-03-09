// Manual bindings — kept in sync with src-tauri/src/commands.rs
// tauri-specta auto-generation is disabled to preserve this simple invoke-based format.

import { invoke } from "@tauri-apps/api/core";

// ─── Context commands ───────────────────────────────────────────

export async function setActiveContext(context: string): Promise<void> {
  return await invoke<void>("set_active_context", { context });
}

export async function getActiveContext(): Promise<string> {
  return await invoke<string>("get_active_context");
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

export async function getAgents(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_agents");
}

export async function getSkills(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_skills");
}

export async function getCommands(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_commands");
}

export async function toggleItem(
  path: string,
  enable: boolean,
  section: string,
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

// ─── Setup file I/O (for dialog-selected paths outside FS scope) ─

export async function writeSetupFile(path: string, content: string): Promise<void> {
  return await invoke<void>("write_setup_file", { path, content });
}

export async function readSetupFile(path: string): Promise<string> {
  return await invoke<string>("read_setup_file", { path });
}

// ─── File preview ───────────────────────────────────────────────

export async function readItemContent(path: string): Promise<string> {
  return await invoke<string>("read_item_content", { path });
}

export async function copyItemToProject(sourcePath: string, section: string): Promise<AgentInfo> {
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

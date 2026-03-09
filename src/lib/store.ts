import { create } from "zustand";
import {
  type AgentInfo,
  type Setup,
  type ClaudeMdProfile,
  getAgents,
  getSkills,
  getCommands,
  toggleItem as toggleItemIPC,
  toggleBatch as toggleBatchIPC,
  getSetups as getSetupsIPC,
  getActiveSetup as getActiveSetupIPC,
  clearActiveSetup as clearActiveSetupIPC,
  createSetup as createSetupIPC,
  deleteSetup as deleteSetupIPC,
  applySetup as applySetupIPC,
  exportSetup as exportSetupIPC,
  importSetup as importSetupIPC,
  listClaudeProfiles as listClaudeProfilesIPC,
  createClaudeProfile as createClaudeProfileIPC,
  activateClaudeProfile as activateClaudeProfileIPC,
  deactivateClaudeProfile as deactivateClaudeProfileIPC,
  deleteClaudeProfile as deleteClaudeProfileIPC,
  readClaudeProfile as readClaudeProfileIPC,
  saveClaudeProfile as saveClaudeProfileIPC,
  renameClaudeProfile as renameClaudeProfileIPC,
} from "../bindings";

export type Section = "setup" | "agents" | "skills" | "commands" | "library" | "claude-md";
export type ItemSection = "agents" | "skills" | "commands";
export type Filter = "all" | "enabled" | "disabled";

// Guard against double-click: tracks item IDs currently being toggled
const togglingIds = new Set<string>();

// Toast auto-hide timer
let toastTimer: ReturnType<typeof setTimeout> | null = null;

interface ToastState {
  message: string;
  visible: boolean;
  type: "success" | "error";
}

interface SetupSnapshotEntry {
  id: string;
  enabled: boolean;
}

interface AppStore {
  agents: AgentInfo[];
  skills: AgentInfo[];
  commands: AgentInfo[];
  activeSection: Section;
  searchQuery: string;
  filter: Filter;
  loading: boolean;
  toast: ToastState;
  setups: Setup[];
  activeSetup: string | null;
  setupSnapshot: SetupSnapshotEntry[];
  setupIds: Set<string>;
  setupIdsInitialized: boolean;
  advancedFeatures: boolean;
  skipGroupWarnings: boolean;
  claudeProfiles: ClaudeMdProfile[];

  loadSection: (section: Section) => Promise<void>;
  silentReload: (section?: Section) => Promise<void>;
  toggleItem: (item: AgentInfo) => Promise<boolean>;
  toggleGroup: (items: AgentInfo[], enable: boolean) => Promise<boolean>;
  setActiveSection: (section: Section) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: Filter) => void;
  showToast: (message: string, type?: "success" | "error") => void;
  hideToast: () => void;
  syncSetupIds: () => void;
  addToSetup: (id: string) => void;
  removeFromSetup: (id: string) => void;
  clearSetup: () => Promise<void>;
  loadSetups: (opts?: { skipSnapshot?: boolean }) => Promise<void>;
  createSetup: (name: string) => Promise<void>;
  deleteSetup: (name: string) => Promise<void>;
  applySetup: (name: string) => Promise<void>;
  updateSetup: () => Promise<void>;
  exportSetup: (name: string) => Promise<string>;
  importSetup: (json: string) => Promise<void>;
  setAdvancedFeatures: (enabled: boolean) => void;
  setSkipGroupWarnings: (enabled: boolean) => void;
  loadClaudeProfiles: () => Promise<void>;
  createClaudeProfile: (name: string, fromCurrent: boolean) => Promise<void>;
  activateClaudeProfile: (name: string) => Promise<void>;
  deactivateClaudeProfile: () => Promise<void>;
  deleteClaudeProfile: (name: string) => Promise<void>;
  readClaudeProfile: (name: string) => Promise<string>;
  saveClaudeProfile: (name: string, content: string) => Promise<void>;
  renameClaudeProfile: (oldName: string, newName: string) => Promise<void>;
}

const sectionLoaders = {
  agents: getAgents,
  skills: getSkills,
  commands: getCommands,
} as const;

const SETUP_IDS_KEY = "orchestrarium-setup-ids";

function loadPersistedSetupIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SETUP_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set<string>();
}

function persistSetupIds(ids: Set<string>) {
  localStorage.setItem(SETUP_IDS_KEY, JSON.stringify([...ids]));
}

export const useAppStore = create<AppStore>((set, get) => ({
  agents: [],
  skills: [],
  commands: [],
  activeSection: "setup",
  searchQuery: "",
  filter: "all",
  loading: false,
  toast: { message: "", visible: false, type: "success" },
  setups: [],
  activeSetup: null,
  setupSnapshot: [],
  setupIds: new Set<string>(),
  setupIdsInitialized: false,
  advancedFeatures: localStorage.getItem("orchestrarium-advanced-features") === "true",
  skipGroupWarnings: localStorage.getItem("orchestrarium-skip-group-warnings") === "true",
  claudeProfiles: [],

  loadSection: async (section) => {
    set({ loading: true });
    try {
      if (section === "setup") {
        // Load all three sections for the dashboard
        const [agents, skills, commands] = await Promise.all([
          getAgents(),
          getSkills(),
          getCommands(),
        ]);
        set({ agents, skills, commands, loading: false });
      } else if (section === "library") {
        await get().loadSetups();
        set({ loading: false });
      } else if (section === "claude-md") {
        await get().loadClaudeProfiles();
        set({ loading: false });
      } else {
        const data = await sectionLoaders[section]();
        set({ [section]: data, loading: false } as Partial<AppStore>);
      }
    } catch {
      set({ loading: false });
      get().showToast(`Failed to load ${section}`, "error");
    }
  },

  silentReload: async (section?) => {
    try {
      const target = section ?? get().activeSection;
      if (target === "setup") {
        const [agents, skills, commands] = await Promise.all([
          getAgents(),
          getSkills(),
          getCommands(),
        ]);
        set({ agents, skills, commands });
      } else if (target === "library") {
        await get().loadSetups();
      } else if (target === "claude-md") {
        await get().loadClaudeProfiles();
      } else {
        const data = await sectionLoaders[target as ItemSection]();
        set({ [target]: data } as Partial<AppStore>);
      }
    } catch {
      // silent — no toast
    }
  },

  toggleItem: async (item) => {
    if (togglingIds.has(item.id)) return false;
    togglingIds.add(item.id);

    const section = item.section as "agents" | "skills" | "commands";
    const newEnabled = !item.enabled;

    // Optimistic update
    set(
      (state) =>
        ({
          [section]: state[section].map((a: AgentInfo) =>
            a.id === item.id ? { ...a, enabled: newEnabled } : a,
          ),
        }) as Partial<AppStore>,
    );

    try {
      await toggleItemIPC(item.path, newEnabled, item.section);
      await get().silentReload(section);
      return true;
    } catch {
      // Revert
      set(
        (state) =>
          ({
            [section]: state[section].map((a: AgentInfo) =>
              a.id === item.id ? { ...a, enabled: item.enabled } : a,
            ),
          }) as Partial<AppStore>,
      );
      get().showToast(`Failed to toggle ${item.name}`, "error");
      return false;
    } finally {
      togglingIds.delete(item.id);
    }
  },

  toggleGroup: async (items, enable) => {
    const section = items[0]?.section as "agents" | "skills" | "commands";
    if (!section) return true;

    // Filter to only items that need toggling and not already in-flight
    const toToggle = items.filter((i) => i.enabled !== enable && !togglingIds.has(i.id));
    if (toToggle.length === 0) return true;

    for (const i of toToggle) togglingIds.add(i.id);

    // Optimistic update all
    set(
      (state) =>
        ({
          [section]: state[section].map((a: AgentInfo) => {
            const inGroup = items.some((i) => i.id === a.id);
            return inGroup ? { ...a, enabled: enable } : a;
          }),
        }) as Partial<AppStore>,
    );

    try {
      const failures = await toggleBatchIPC(
        toToggle.map((i) => ({ path: i.path, enable })),
      );
      await get().silentReload(section);
      if (failures.length > 0) {
        get().showToast(
          `Failed to toggle ${failures.length} item${failures.length > 1 ? "s" : ""}`,
          "error",
        );
        return false;
      }
      return true;
    } catch {
      await get().silentReload(section);
      get().showToast("Failed to toggle group", "error");
      return false;
    } finally {
      for (const i of toToggle) togglingIds.delete(i.id);
    }
  },

  setActiveSection: (section) => set({ activeSection: section, searchQuery: "", filter: "all" }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilter: (filter) => set({ filter }),

  syncSetupIds: () => {
    const all = [...get().agents, ...get().skills, ...get().commands];
    if (all.length === 0) return;
    const allIds = new Set(all.map((i) => i.id));
    if (!get().setupIdsInitialized) {
      const persisted = loadPersistedSetupIds();
      // First run: use persisted if available, otherwise seed from enabled items
      const ids = persisted.size > 0
        ? new Set([...persisted].filter((id) => allIds.has(id)))
        : new Set(all.filter((i) => i.enabled).map((i) => i.id));
      persistSetupIds(ids);
      set({ setupIds: ids, setupIdsInitialized: true });
    } else {
      // Subsequent runs: only prune deleted items, never auto-add
      const current = get().setupIds;
      const next = new Set([...current].filter((id) => allIds.has(id)));
      if (next.size !== current.size) {
        persistSetupIds(next);
        set({ setupIds: next });
      }
    }
  },

  addToSetup: (id) => {
    set((state) => {
      const next = new Set(state.setupIds);
      next.add(id);
      persistSetupIds(next);
      return { setupIds: next };
    });
  },

  removeFromSetup: (id) => {
    set((state) => {
      const next = new Set(state.setupIds);
      next.delete(id);
      persistSetupIds(next);
      return { setupIds: next };
    });
  },

  clearSetup: async () => {
    const all = [...get().agents, ...get().skills, ...get().commands];
    const enabled = all.filter((i) => get().setupIds.has(i.id) && i.enabled);
    if (enabled.length > 0) {
      const failures = await toggleBatchIPC(enabled.map((i) => ({ path: i.path, enable: false })));
      if (failures.length > 0) {
        get().showToast(`Failed to disable ${failures.length} item(s)`, "error");
        await get().silentReload("setup");
        throw undefined;
      }
    }
    const empty = new Set<string>();
    persistSetupIds(empty);
    set({ setupIds: empty, activeSetup: null, setupSnapshot: [] });
    await clearActiveSetupIPC();
    await get().silentReload("setup");
  },

  showToast: (message, type = "success") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { message, visible: true, type } });
    toastTimer = setTimeout(() => get().hideToast(), 4000);
  },
  hideToast: () => set({ toast: { message: "", visible: false, type: "success" } }),

  loadSetups: async (opts) => {
    try {
      const [setups, activeSetup] = await Promise.all([
        getSetupsIPC(),
        getActiveSetupIPC(),
      ]);
      set({ setups, activeSetup });
      // Restore snapshot from saved setup if active and snapshot is empty
      if (!opts?.skipSnapshot && activeSetup && get().setupSnapshot.length === 0) {
        const active = setups.find((s) => s.name === activeSetup);
        if (active) {
          const ids = get().setupIds.size > 0 ? get().setupIds : loadPersistedSetupIds();
          set({ setupSnapshot: active.entries
            .filter((e) => ids.has(e.id))
            .map((e) => ({ id: e.id, enabled: e.enabled })) });
        }
      }
    } catch {
      get().showToast("Failed to load setups", "error");
    }
  },

  createSetup: async (name) => {
    try {
      await createSetupIPC(name);
      await get().loadSetups();
      // Save snapshot so Update button works immediately
      const all = [...get().agents, ...get().skills, ...get().commands];
      const ids = get().setupIds;
      const snapshot = all
        .filter((i) => ids.has(i.id))
        .map((i) => ({ id: i.id, enabled: i.enabled }));
      set({ setupSnapshot: snapshot });
    } catch {
      get().showToast("Failed to create setup", "error");
      throw undefined;
    }
  },

  deleteSetup: async (name) => {
    try {
      await deleteSetupIPC(name);
      await get().loadSetups();
    } catch {
      get().showToast("Failed to delete setup", "error");
      throw undefined;
    }
  },

  applySetup: async (name) => {
    try {
      const failures = await applySetupIPC(name);
      await get().loadSetups({ skipSnapshot: true });
      // Reload all sections
      const [agents, skills, commands] = await Promise.all([
        getAgents(),
        getSkills(),
        getCommands(),
      ]);
      set({ agents, skills, commands });
      // Sync setupIds to match the newly applied state
      const all = [...agents, ...skills, ...commands];
      const ids = new Set(all.filter((i) => i.enabled).map((i) => i.id));
      persistSetupIds(ids);
      // Save snapshot of applied state for change detection
      const snapshot = all
        .filter((i) => ids.has(i.id))
        .map((i) => ({ id: i.id, enabled: i.enabled }));
      set({ setupIds: ids, setupSnapshot: snapshot });
      if (failures.length > 0) {
        get().showToast(`Setup applied with ${failures.length} error(s)`, "error");
      }
    } catch {
      get().showToast("Failed to apply setup", "error");
      throw undefined;
    }
  },

  updateSetup: async () => {
    const name = get().activeSetup;
    if (!name) return;
    try {
      // create_setup does upsert (retain + push), so no separate delete needed
      await createSetupIPC(name);
      await get().loadSetups();
      // Update snapshot to current state
      const all = [...get().agents, ...get().skills, ...get().commands];
      const snapshot = all
        .filter((i) => get().setupIds.has(i.id))
        .map((i) => ({ id: i.id, enabled: i.enabled }));
      set({ setupSnapshot: snapshot });
    } catch {
      get().showToast("Failed to update setup", "error");
      throw undefined;
    }
  },

  exportSetup: async (name) => {
    try {
      return await exportSetupIPC(name);
    } catch {
      get().showToast("Failed to export setup", "error");
      return "";
    }
  },

  importSetup: async (json) => {
    try {
      await importSetupIPC(json);
      await get().loadSetups();
    } catch {
      get().showToast("Failed to import setup", "error");
    }
  },

  setAdvancedFeatures: (enabled) => {
    localStorage.setItem("orchestrarium-advanced-features", String(enabled));
    set({ advancedFeatures: enabled });
    if (!enabled && get().activeSection === "claude-md") {
      set({ activeSection: "setup" });
      get().loadSection("setup");
    }
  },

  setSkipGroupWarnings: (enabled) => {
    localStorage.setItem("orchestrarium-skip-group-warnings", String(enabled));
    set({ skipGroupWarnings: enabled });
  },

  loadClaudeProfiles: async () => {
    try {
      const profiles = await listClaudeProfilesIPC();
      set({ claudeProfiles: profiles });
    } catch {
      get().showToast("Failed to load profiles", "error");
    }
  },

  createClaudeProfile: async (name, fromCurrent) => {
    try {
      await createClaudeProfileIPC(name, fromCurrent);
      await get().loadClaudeProfiles();
    } catch (e) {
      get().showToast(String(e), "error");
      throw undefined;
    }
  },

  activateClaudeProfile: async (name) => {
    try {
      await activateClaudeProfileIPC(name);
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to activate profile", "error");
      throw undefined;
    }
  },

  deactivateClaudeProfile: async () => {
    try {
      await deactivateClaudeProfileIPC();
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to deactivate profile", "error");
      throw undefined;
    }
  },

  deleteClaudeProfile: async (name) => {
    try {
      await deleteClaudeProfileIPC(name);
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to delete profile", "error");
      throw undefined;
    }
  },

  readClaudeProfile: async (name) => {
    try {
      return await readClaudeProfileIPC(name);
    } catch {
      get().showToast("Failed to read profile", "error");
      return "";
    }
  },

  saveClaudeProfile: async (name, content) => {
    try {
      await saveClaudeProfileIPC(name, content);
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to save profile", "error");
      throw undefined;
    }
  },

  renameClaudeProfile: async (oldName, newName) => {
    try {
      await renameClaudeProfileIPC(oldName, newName);
      await get().loadClaudeProfiles();
    } catch (e) {
      get().showToast(String(e), "error");
      throw undefined;
    }
  },
}));

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

interface ToastState {
  message: string;
  visible: boolean;
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
  toggleItem: (item: AgentInfo) => Promise<void>;
  toggleGroup: (items: AgentInfo[], enable: boolean) => Promise<void>;
  setActiveSection: (section: Section) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: Filter) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  syncSetupIds: () => void;
  addToSetup: (id: string) => void;
  removeFromSetup: (id: string) => void;
  clearSetup: () => Promise<void>;
  loadSetups: () => Promise<void>;
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
  toast: { message: "", visible: false },
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
      get().showToast(`Failed to load ${section}`);
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
      get().showToast(`Failed to toggle ${item.name}`);
    }
  },

  toggleGroup: async (items, enable) => {
    const section = items[0]?.section as "agents" | "skills" | "commands";
    if (!section) return;

    // Filter to only items that need toggling
    const toToggle = items.filter((i) => i.enabled !== enable);
    if (toToggle.length === 0) return;

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
        );
      }
    } catch {
      await get().silentReload(section);
      get().showToast("Failed to toggle group");
    }
  },

  setActiveSection: (section) => set({ activeSection: section, searchQuery: "", filter: "all" }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilter: (filter) => set({ filter }),

  syncSetupIds: () => {
    const all = [...get().agents, ...get().skills, ...get().commands];
    if (all.length === 0) return;
    const persisted = loadPersistedSetupIds();
    if (!get().setupIdsInitialized) {
      // First run: use persisted or seed from enabled items
      const ids = persisted.size > 0 ? persisted : new Set(all.filter((i) => i.enabled).map((i) => i.id));
      // Also add any enabled items not yet in persisted set (new files)
      for (const item of all) {
        if (item.enabled) ids.add(item.id);
      }
      persistSetupIds(ids);
      set({ setupIds: ids, setupIdsInitialized: true });
    } else {
      // Subsequent runs: add any new enabled items not yet tracked
      const current = get().setupIds;
      let changed = false;
      const next = new Set(current);
      for (const item of all) {
        if (item.enabled && !next.has(item.id)) {
          next.add(item.id);
          changed = true;
        }
      }
      if (changed) {
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
      await toggleBatchIPC(enabled.map((i) => ({ path: i.path, enable: false })));
    }
    const empty = new Set<string>();
    persistSetupIds(empty);
    set({ setupIds: empty, activeSetup: null, setupSnapshot: [] });
    await clearActiveSetupIPC();
    await get().silentReload("setup");
  },

  showToast: (message) => {
    set({ toast: { message, visible: true } });
    setTimeout(() => get().hideToast(), 4000);
  },
  hideToast: () => set({ toast: { message: "", visible: false } }),

  loadSetups: async () => {
    try {
      const [setups, activeSetup] = await Promise.all([
        getSetupsIPC(),
        getActiveSetupIPC(),
      ]);
      set({ setups, activeSetup });
      // Restore snapshot from saved setup if active and snapshot is empty
      if (activeSetup && get().setupSnapshot.length === 0) {
        const active = setups.find((s) => s.name === activeSetup);
        if (active) {
          const ids = get().setupIds.size > 0 ? get().setupIds : loadPersistedSetupIds();
          set({ setupSnapshot: active.entries
            .filter((e) => ids.has(e.id))
            .map((e) => ({ id: e.id, enabled: e.enabled })) });
        }
      }
    } catch {
      get().showToast("Failed to load setups");
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
      get().showToast("Failed to create setup");
    }
  },

  deleteSetup: async (name) => {
    try {
      await deleteSetupIPC(name);
      await get().loadSetups();
    } catch {
      get().showToast("Failed to delete setup");
    }
  },

  applySetup: async (name) => {
    try {
      const failures = await applySetupIPC(name);
      await get().loadSetups();
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
        get().showToast(`Setup applied with ${failures.length} error(s)`);
      }
    } catch {
      get().showToast("Failed to apply setup");
    }
  },

  updateSetup: async () => {
    const name = get().activeSetup;
    if (!name) return;
    try {
      // Delete old and create new snapshot with same name
      await deleteSetupIPC(name);
      await createSetupIPC(name);
      await get().loadSetups();
      // Update snapshot to current state
      const all = [...get().agents, ...get().skills, ...get().commands];
      const snapshot = all
        .filter((i) => get().setupIds.has(i.id))
        .map((i) => ({ id: i.id, enabled: i.enabled }));
      set({ setupSnapshot: snapshot });
    } catch {
      get().showToast("Failed to update setup");
    }
  },

  exportSetup: async (name) => {
    try {
      return await exportSetupIPC(name);
    } catch {
      get().showToast("Failed to export setup");
      return "";
    }
  },

  importSetup: async (json) => {
    try {
      await importSetupIPC(json);
      await get().loadSetups();
    } catch {
      get().showToast("Failed to import setup");
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
      get().showToast("Failed to load profiles");
    }
  },

  createClaudeProfile: async (name, fromCurrent) => {
    try {
      await createClaudeProfileIPC(name, fromCurrent);
      await get().loadClaudeProfiles();
    } catch (e) {
      get().showToast(String(e));
    }
  },

  activateClaudeProfile: async (name) => {
    try {
      await activateClaudeProfileIPC(name);
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to activate profile");
    }
  },

  deactivateClaudeProfile: async () => {
    try {
      await deactivateClaudeProfileIPC();
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to deactivate profile");
    }
  },

  deleteClaudeProfile: async (name) => {
    try {
      await deleteClaudeProfileIPC(name);
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to delete profile");
    }
  },

  readClaudeProfile: async (name) => {
    try {
      return await readClaudeProfileIPC(name);
    } catch {
      get().showToast("Failed to read profile");
      return "";
    }
  },

  saveClaudeProfile: async (name, content) => {
    try {
      await saveClaudeProfileIPC(name, content);
      await get().loadClaudeProfiles();
    } catch {
      get().showToast("Failed to save profile");
    }
  },

  renameClaudeProfile: async (oldName, newName) => {
    try {
      await renameClaudeProfileIPC(oldName, newName);
      await get().loadClaudeProfiles();
    } catch (e) {
      get().showToast(String(e));
    }
  },
}));

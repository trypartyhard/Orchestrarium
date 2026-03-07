import { create } from "zustand";
import {
  type AgentInfo,
  type Setup,
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
} from "../bindings";

export type Section = "setup" | "agents" | "skills" | "commands" | "library";
export type ItemSection = "agents" | "skills" | "commands";
export type Filter = "all" | "enabled" | "disabled";

interface ToastState {
  message: string;
  visible: boolean;
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
  setupIds: Set<string>;
  setupIdsInitialized: boolean;

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
  exportSetup: (name: string) => Promise<string>;
  importSetup: (json: string) => Promise<void>;
}

const sectionLoaders = {
  agents: getAgents,
  skills: getSkills,
  commands: getCommands,
} as const;

const SETUP_IDS_KEY = "cam-setup-ids";

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
  setupIds: new Set<string>(),
  setupIdsInitialized: false,

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

  setActiveSection: (section) => set({ activeSection: section }),
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
    set({ setupIds: empty, activeSetup: null });
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
    } catch {
      get().showToast("Failed to load setups");
    }
  },

  createSetup: async (name) => {
    try {
      await createSetupIPC(name);
      await get().loadSetups();
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
      set({ setupIds: ids });
      if (failures.length > 0) {
        get().showToast(`Setup applied with ${failures.length} error(s)`);
      }
    } catch {
      get().showToast("Failed to apply setup");
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
}));

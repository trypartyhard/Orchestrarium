import { create } from "zustand";
import {
  type AgentInfo,
  type Setup,
  getAgents,
  getSkills,
  getCommands,
  toggleItem as toggleItemIPC,
  getSetups as getSetupsIPC,
  getActiveSetup as getActiveSetupIPC,
  createSetup as createSetupIPC,
  deleteSetup as deleteSetupIPC,
  applySetup as applySetupIPC,
  exportSetup as exportSetupIPC,
  importSetup as importSetupIPC,
} from "../bindings";

export type Section = "setup" | "agents" | "skills" | "commands";
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

  loadSection: (section: Section) => Promise<void>;
  toggleItem: (item: AgentInfo) => Promise<void>;
  toggleGroup: (items: AgentInfo[], enable: boolean) => Promise<void>;
  setActiveSection: (section: Section) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: Filter) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
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
      } else {
        const data = await sectionLoaders[section]();
        set({ [section]: data, loading: false } as Partial<AppStore>);
      }
    } catch {
      set({ loading: false });
      get().showToast(`Failed to load ${section}`);
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
      // Silent reload to get accurate paths (no loading spinner)
      const data = await sectionLoaders[section]();
      set({ [section]: data } as Partial<AppStore>);
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

    // Toggle each sequentially
    const failed: AgentInfo[] = [];
    for (const item of items) {
      if (item.enabled === enable) continue;
      try {
        await toggleItemIPC(item.path, enable, item.section);
      } catch {
        failed.push(item);
      }
    }

    // Silent reload for accurate state (no loading spinner)
    const data = await sectionLoaders[section]();
    set({ [section]: data } as Partial<AppStore>);

    if (failed.length > 0) {
      get().showToast(
        `Failed to toggle ${failed.length} item${failed.length > 1 ? "s" : ""}`,
      );
    }
  },

  setActiveSection: (section) => set({ activeSection: section }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilter: (filter) => set({ filter }),

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

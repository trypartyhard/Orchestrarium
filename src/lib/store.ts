import { create } from "zustand";
import {
  type AgentInfo,
  getAgents,
  getSkills,
  getCommands,
  toggleItem as toggleItemIPC,
} from "../bindings";

export type Section = "agents" | "skills" | "commands";
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

  loadSection: (section: Section) => Promise<void>;
  toggleItem: (item: AgentInfo) => Promise<void>;
  toggleGroup: (items: AgentInfo[], enable: boolean) => Promise<void>;
  setActiveSection: (section: Section) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: Filter) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
}

const loaders = {
  agents: getAgents,
  skills: getSkills,
  commands: getCommands,
} as const;

export const useAppStore = create<AppStore>((set, get) => ({
  agents: [],
  skills: [],
  commands: [],
  activeSection: "agents",
  searchQuery: "",
  filter: "all",
  loading: false,
  toast: { message: "", visible: false },

  loadSection: async (section) => {
    set({ loading: true });
    try {
      const data = await loaders[section]();
      set({ [section]: data, loading: false } as Partial<AppStore>);
    } catch {
      set({ loading: false });
      get().showToast(`Failed to load ${section}`);
    }
  },

  toggleItem: async (item) => {
    const section = item.section as Section;
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
      // Reload to get accurate paths
      await get().loadSection(section);
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
    const section = items[0]?.section as Section;
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

    // Reload section for accurate state
    await get().loadSection(section);

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
}));

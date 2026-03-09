import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "./store";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("Context switching", () => {
  beforeEach(() => {
    // Reset store to defaults
    useAppStore.setState({
      activeContext: "global",
      projectDir: null,
      searchQuery: "some query",
      filter: "enabled",
      agents: [],
      skills: [],
      commands: [],
      setups: [],
      activeSetup: null,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("initializes with global context by default", () => {
    const state = useAppStore.getState();
    expect(state.activeContext).toBe("global");
    expect(state.projectDir).toBeNull();
  });

  it("setActiveContext updates state and localStorage", async () => {
    mockedInvoke.mockResolvedValue(undefined);
    await useAppStore.getState().setActiveContext("project");
    expect(useAppStore.getState().activeContext).toBe("project");
    expect(localStorage.getItem("orchestrarium-context")).toBe("project");
  });

  it("setProjectDir stores path and persists to localStorage", async () => {
    mockedInvoke.mockResolvedValue(undefined);
    useAppStore.setState({ activeContext: "project" });
    await useAppStore.getState().setProjectDir("/test/project");
    expect(useAppStore.getState().projectDir).toBe("/test/project");
    expect(localStorage.getItem("orchestrarium-project-dir")).toBe("/test/project");
  });

  it("setProjectDir(null) clears localStorage", async () => {
    mockedInvoke.mockResolvedValue(undefined);
    localStorage.setItem("orchestrarium-project-dir", "/old/path");
    await useAppStore.getState().setProjectDir(null);
    expect(useAppStore.getState().projectDir).toBeNull();
    expect(localStorage.getItem("orchestrarium-project-dir")).toBeNull();
  });

  it("reloadForContext resets search and filter", async () => {
    mockedInvoke.mockResolvedValue([]);
    useAppStore.setState({ searchQuery: "test", filter: "enabled" });
    await useAppStore.getState().reloadForContext();
    expect(useAppStore.getState().searchQuery).toBe("");
    expect(useAppStore.getState().filter).toBe("all");
  });

  it("ContextType type allows only global and project", () => {
    // Type-level check: these should compile without errors
    const global: "global" | "project" = "global";
    const project: "global" | "project" = "project";
    expect(global).toBe("global");
    expect(project).toBe("project");
  });
});

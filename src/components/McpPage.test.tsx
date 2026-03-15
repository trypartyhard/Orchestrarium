import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { McpPage } from "./McpPage";
import { useAppStore } from "../lib/store";

const defaultToggleMcpServer = useAppStore.getState().toggleMcpServer;
const defaultGetMcpServerDetail = useAppStore.getState().getMcpServerDetail;
const defaultCreateMcpServer = useAppStore.getState().createMcpServer;
const defaultUpdateMcpServer = useAppStore.getState().updateMcpServer;
const defaultDeleteMcpServer = useAppStore.getState().deleteMcpServer;
const defaultCreateMcpProfile = useAppStore.getState().createMcpProfile;
const defaultActivateMcpProfile = useAppStore.getState().activateMcpProfile;
const defaultDeactivateMcpProfile = useAppStore.getState().deactivateMcpProfile;
const defaultDeleteMcpProfile = useAppStore.getState().deleteMcpProfile;
const defaultReadMcpProfile = useAppStore.getState().readMcpProfile;
const defaultSaveMcpProfile = useAppStore.getState().saveMcpProfile;
const defaultPreviewActivateMcpProfile = useAppStore.getState().previewActivateMcpProfile;

describe("McpPage", () => {
  beforeEach(() => {
    useAppStore.setState({
      mcpServers: [],
      mcpProfiles: [],
      loading: false,
      searchQuery: "",
      filter: "all",
      activeContext: "global",
      projectDir: null,
      toggleMcpServer: defaultToggleMcpServer,
      getMcpServerDetail: defaultGetMcpServerDetail,
      createMcpServer: defaultCreateMcpServer,
      updateMcpServer: defaultUpdateMcpServer,
      deleteMcpServer: defaultDeleteMcpServer,
      createMcpProfile: defaultCreateMcpProfile,
      activateMcpProfile: defaultActivateMcpProfile,
      deactivateMcpProfile: defaultDeactivateMcpProfile,
      deleteMcpProfile: defaultDeleteMcpProfile,
      readMcpProfile: defaultReadMcpProfile,
      saveMcpProfile: defaultSaveMcpProfile,
      previewActivateMcpProfile: defaultPreviewActivateMcpProfile,
    });
  });

  it("shows Profiles as the default tab in global context", () => {
    render(<McpPage />);

    expect(screen.getByText("MCP")).toBeInTheDocument();
    expect(screen.getByText(/Activate a global MCP bundle into/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Profiles tab" })).toBeInTheDocument();
  });

  it("switches to Live Servers and renders the existing live MCP manager", () => {
    useAppStore.setState({
      mcpServers: [
        {
          id: "claude-json-global::github",
          name: "github",
          source: "claudeJson",
          scope: "global",
          enabled: true,
          serverType: "http",
          projectPath: null,
          canToggle: false,
          canEdit: false,
          redactedPreview: '{\n  "url": "https://example.com/mcp"\n}',
        },
      ],
    });

    render(<McpPage />);

    fireEvent.click(screen.getByRole("button", { name: "Live Servers tab" }));

    expect(screen.getByText("MCP Servers")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("~/.claude.json")).toBeInTheDocument();
  });

  it("activates a profile after successful preflight", async () => {
    const previewActivateMcpProfile = vi.fn().mockResolvedValue({
      profileName: "backend-dev",
      serverCount: 2,
      canActivate: true,
      collisions: [],
      issues: [],
    });
    const activateMcpProfile = vi.fn().mockResolvedValue(true);

    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
      mcpProfiles: [
        {
          name: "backend-dev",
          active: false,
          serverCount: 2,
          healthStatus: "ok",
          serverTypes: ["command", "http"],
        },
      ],
      previewActivateMcpProfile,
      activateMcpProfile,
    });

    render(<McpPage />);

    fireEvent.click(screen.getByRole("button", { name: /^Activate$/i }));

    await waitFor(() => {
      expect(previewActivateMcpProfile).toHaveBeenCalledWith("backend-dev");
      expect(activateMcpProfile).toHaveBeenCalledWith("backend-dev");
    });
  });

  it("shows activation issues when preflight blocks the profile", async () => {
    const previewActivateMcpProfile = vi.fn().mockResolvedValue({
      profileName: "backend-dev",
      serverCount: 1,
      canActivate: false,
      collisions: ["docs"],
      issues: [
        {
          kind: "conflict",
          message: "Profile 'backend-dev' collides with manual live servers: docs",
          blocking: true,
        },
      ],
    });

    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
      mcpProfiles: [
        {
          name: "backend-dev",
          active: false,
          serverCount: 1,
          healthStatus: "conflict",
          serverTypes: ["http"],
        },
      ],
      previewActivateMcpProfile,
    });

    render(<McpPage />);

    fireEvent.click(screen.getByRole("button", { name: /^Activate$/i }));

    await waitFor(() => {
      expect(screen.getByText("Activation blocked")).toBeInTheDocument();
      expect(screen.getByText(/collides with manual live servers: docs/)).toBeInTheDocument();
    });
  });

  it("runs standalone validation and shows ready state", async () => {
    const previewActivateMcpProfile = vi.fn().mockResolvedValue({
      profileName: "backend-dev",
      serverCount: 2,
      canActivate: true,
      collisions: [],
      issues: [],
    });

    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
      mcpProfiles: [
        {
          name: "backend-dev",
          active: false,
          serverCount: 2,
          healthStatus: "ok",
          serverTypes: ["command", "http"],
        },
      ],
      previewActivateMcpProfile,
    });

    render(<McpPage />);

    fireEvent.click(screen.getByRole("button", { name: "Validate profile" }));

    await waitFor(() => {
      expect(previewActivateMcpProfile).toHaveBeenCalledWith("backend-dev");
      expect(screen.getByText("Ready to activate")).toBeInTheDocument();
    });
  });

  it("opens read-only preview with server details", async () => {
    const readMcpProfile = vi.fn().mockResolvedValue(`{
  "name": "backend-dev",
  "servers": {
    "filesystem": {
      "type": "command",
      "command": "npx"
    },
    "docs": {
      "type": "http",
      "url": "https://example.com/mcp"
    }
  }
}`);
    const previewActivateMcpProfile = vi.fn().mockResolvedValue({
      profileName: "backend-dev",
      serverCount: 2,
      canActivate: true,
      collisions: [],
      issues: [],
    });

    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
      mcpProfiles: [
        {
          name: "backend-dev",
          active: false,
          serverCount: 2,
          healthStatus: "ok",
          serverTypes: ["command", "http"],
        },
      ],
      readMcpProfile,
      previewActivateMcpProfile,
    });

    render(<McpPage />);

    fireEvent.click(screen.getByRole("button", { name: "Preview profile" }));

    await waitFor(() => {
      expect(screen.getByText("Servers in this profile")).toBeInTheDocument();
      expect(screen.getByText("filesystem")).toBeInTheDocument();
      expect(screen.getByText("docs")).toBeInTheDocument();
      expect(screen.getByText(/"command"/)).toBeInTheDocument();
      expect(screen.getByText(/"url"/)).toBeInTheDocument();
    });
  });
});

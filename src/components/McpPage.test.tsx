import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { McpPage } from "./McpPage";
import { useAppStore } from "../lib/store";

const defaultToggleMcpServer = useAppStore.getState().toggleMcpServer;
const defaultGetMcpServerDetail = useAppStore.getState().getMcpServerDetail;
const defaultCreateMcpServer = useAppStore.getState().createMcpServer;
const defaultUpdateMcpServer = useAppStore.getState().updateMcpServer;
const defaultDeleteMcpServer = useAppStore.getState().deleteMcpServer;

describe("McpPage", () => {
  beforeEach(() => {
    useAppStore.setState({
      mcpServers: [],
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
    });
  });

  it("renders empty state when there are no MCP servers", () => {
    render(<McpPage />);

    expect(screen.getByText("MCP Servers")).toBeInTheDocument();
    expect(screen.getByText("No MCP servers found")).toBeInTheDocument();
    expect(screen.getByText("Add MCP definitions to ~/.claude.json to see them here.")).toBeInTheDocument();
  });

  it("renders MCP server cards", () => {
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

    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("HTTP")).toBeInTheDocument();
    expect(screen.getByText("~/.claude.json")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/example\.com\/mcp/)).toBeInTheDocument();
  });

  it("renders a toggle for .mcp.json-backed servers and calls the store action", () => {
    const toggleMcpServer = vi.fn().mockResolvedValue(true);
    useAppStore.setState({
      toggleMcpServer,
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
      mcpServers: [
        {
          id: "mcp-json::C:/Users/User/Desktop/MyProject::filesystem",
          name: "filesystem",
          source: "mcpJson",
          scope: "project",
          enabled: true,
          serverType: "command",
          projectPath: "C:/Users/User/Desktop/MyProject",
          canToggle: true,
          canEdit: true,
          redactedPreview: '{\n  "command": "npx"\n}',
        },
      ],
    });

    render(<McpPage />);

    expect(screen.getByText(/Toggle writes project overrides/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(toggleMcpServer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mcp-json::C:/Users/User/Desktop/MyProject::filesystem" }),
    );
  });

  it("opens create modal and submits a new local MCP server", async () => {
    const createMcpServer = vi.fn().mockResolvedValue(true);
    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
      createMcpServer,
    });

    render(<McpPage />);

    fireEvent.click(screen.getByText("New Server"));
    fireEvent.change(screen.getByPlaceholderText("filesystem"), {
      target: { value: "filesystem" },
    });
    fireEvent.change(screen.getByPlaceholderText("npx"), {
      target: { value: "npx" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/One argument per line/),
      {
        target: { value: "-y\n@modelcontextprotocol/server-filesystem" },
      },
    );
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(createMcpServer).toHaveBeenCalledWith({
        name: "filesystem",
        serverType: "command",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem"],
        env: {},
        url: null,
        headers: {},
      });
    });
  });
});

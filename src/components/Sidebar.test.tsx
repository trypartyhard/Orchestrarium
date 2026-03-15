import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "../lib/store";

const SECTION_LABELS = [
  "Setup",
  "Agents",
  "Skills",
  "Commands",
  "Library",
  "CLAUDE.md",
  "MCP Servers",
] as const;

describe("Sidebar context switcher", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeContext: "global",
      projectDir: null,
      activeSection: "setup",
    });
  });

  it("renders Global and Project context buttons", () => {
    render(<Sidebar />);
    expect(screen.getByTitle("Global context (~/.claude)")).toBeInTheDocument();
    expect(screen.getByTitle("Open project")).toBeInTheDocument();
    expect(screen.getByTitle("MCP Servers")).toBeInTheDocument();
  });

  it("renders MCP below CLAUDE.md in the sidebar order", () => {
    render(<Sidebar />);

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.getAttribute("title"))
      .filter((label): label is string => SECTION_LABELS.includes(label as typeof SECTION_LABELS[number]));

    expect(labels).toEqual(SECTION_LABELS);
  });

  it("shows project name when project is selected", () => {
    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
    });
    render(<Sidebar />);
    expect(screen.getByText("MyProject")).toBeInTheDocument();
  });

  it("shows Change Project button when in project context", () => {
    useAppStore.setState({
      activeContext: "project",
      projectDir: "C:\\Users\\User\\Desktop\\MyProject",
    });
    render(<Sidebar />);
    expect(screen.getByTitle("Change project folder")).toBeInTheDocument();
  });

  it("does not show Change Project button in global context", () => {
    useAppStore.setState({ activeContext: "global" });
    render(<Sidebar />);
    expect(screen.queryByTitle("Change project folder")).not.toBeInTheDocument();
  });

  it("shows project title with project dir on hover area", () => {
    const projectDir = "C:\\Users\\User\\Desktop\\LongProjectName";
    useAppStore.setState({
      activeContext: "project",
      projectDir,
    });
    render(<Sidebar />);
    expect(screen.getByTitle(projectDir)).toBeInTheDocument();
  });
});

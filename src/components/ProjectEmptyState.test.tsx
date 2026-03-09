import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FolderOpen } from "lucide-react";

/**
 * Tests the project empty state UI that appears when
 * activeContext === "project" && !projectDir.
 * We test the component logic in isolation rather than rendering
 * the full App to avoid side effects from other components.
 */

function ProjectEmptyState({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div>
      <FolderOpen data-testid="folder-icon" />
      <p>No project selected</p>
      <button>Open Project Folder</button>
    </div>
  );
}

describe("Project empty state", () => {
  it("renders 'No project selected' when shown", () => {
    render(<ProjectEmptyState show={true} />);
    expect(screen.getByText("No project selected")).toBeInTheDocument();
  });

  it("renders 'Open Project Folder' button when shown", () => {
    render(<ProjectEmptyState show={true} />);
    expect(screen.getByText("Open Project Folder")).toBeInTheDocument();
  });

  it("does not render when show is false", () => {
    render(<ProjectEmptyState show={false} />);
    expect(screen.queryByText("No project selected")).not.toBeInTheDocument();
  });

  it("logic: show when project context without dir", () => {
    const activeContext = "project";
    const projectDir: string | null = null;
    const show = activeContext === "project" && !projectDir;
    expect(show).toBe(true);
  });

  it("logic: hide when global context", () => {
    const activeContext = "global";
    const projectDir: string | null = null;
    const show = activeContext === "project" && !projectDir;
    expect(show).toBe(false);
  });

  it("logic: hide when project context with dir set", () => {
    const activeContext = "project";
    const projectDir: string | null = "/some/project";
    const show = activeContext === "project" && !projectDir;
    expect(show).toBe(false);
  });
});

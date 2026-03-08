import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders with section name", () => {
    render(<EmptyState section="agents" />);
    expect(screen.getByText("No agents found")).toBeInTheDocument();
  });

  it("shows correct path hint", () => {
    render(<EmptyState section="skills" />);
    expect(screen.getByText("~/.claude/skills/")).toBeInTheDocument();
  });
});

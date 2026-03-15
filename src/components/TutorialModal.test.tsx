import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TutorialModal } from "./TutorialModal";

describe("TutorialModal", () => {
  it("shows MCP Servers in the welcome overview", () => {
    render(<TutorialModal onClose={() => {}} />);

    expect(screen.getByText(/seven sections/i)).toBeInTheDocument();
    expect(screen.getByText("MCP Servers")).toBeInTheDocument();
  });

  it("includes a dedicated MCP tutorial page", () => {
    render(<TutorialModal onClose={() => {}} />);

    for (let index = 0; index < 6; index += 1) {
      fireEvent.click(screen.getByText("Next"));
    }

    expect(
      screen.getByRole("heading", { name: "MCP Servers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Profiles is the default tab:/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Claude Code reads the live MCP config/i),
    ).toBeInTheDocument();
  });
});

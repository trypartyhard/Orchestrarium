import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders the text", () => {
    render(<Badge text="global" />);
    expect(screen.getByText("global")).toBeInTheDocument();
  });

  it("applies error variant classes", () => {
    render(<Badge text="invalid" variant="error" />);
    const badge = screen.getByText("invalid");
    expect(badge.className).toContain("text-red-400");
  });

  it("applies project variant classes", () => {
    render(<Badge text="project" variant="project" />);
    const badge = screen.getByText("project");
    expect(badge.className).toContain("text-[#ffa726]");
  });

  it("defaults to info variant", () => {
    render(<Badge text="info" />);
    const badge = screen.getByText("info");
    expect(badge.className).toContain("text-[#66bb6a]");
  });
});

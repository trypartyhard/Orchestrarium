import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("renders with switch role", () => {
    render(<Toggle enabled={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("reflects enabled state via aria-checked", () => {
    const { rerender } = render(<Toggle enabled={false} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    rerender(<Toggle enabled={true} onToggle={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<Toggle enabled={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not call onToggle when disabled", () => {
    const onToggle = vi.fn();
    render(<Toggle enabled={false} onToggle={onToggle} disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ColorDot } from "./ColorDot";

describe("ColorDot", () => {
  it("renders with the given color", () => {
    const { container } = render(<ColorDot color="#ff0000" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("falls back to gray when color is null", () => {
    const { container } = render(<ColorDot color={null} />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.style.backgroundColor).toBe("rgb(107, 107, 120)");
  });
});

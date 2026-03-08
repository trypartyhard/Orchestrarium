import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { useEscapeKey } from "./useEscapeKey";

describe("useEscapeKey", () => {
  it("calls callback when Escape is pressed", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("does not call callback for other keys", () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(onEscape));
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("cleans up listener on unmount", () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(onEscape));
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onEscape).not.toHaveBeenCalled();
  });
});

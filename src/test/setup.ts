import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

// Mock Tauri API — core invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock Tauri window API
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    listen: vi.fn(() => Promise.resolve(vi.fn())),
  }),
}));

// Mock Tauri event API
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
  emit: vi.fn(),
}));

// Mock Tauri plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock Tauri plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

// Mock framer-motion: forward all props to real DOM elements
function createMotionProxy() {
  return new Proxy({}, {
    get(_target, tag: string) {
      return React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        // Filter out motion-specific props, keep standard HTML props
        const motionProps = [
          "initial", "animate", "exit", "transition", "variants",
          "whileHover", "whileTap", "whileFocus", "whileDrag",
          "whileInView", "layout", "layoutId", "onAnimationStart",
          "onAnimationComplete",
        ];
        const filtered: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(props)) {
          if (!motionProps.includes(key)) filtered[key] = val;
        }
        return React.createElement(tag, { ...filtered, ref });
      });
    },
  });
}

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: createMotionProxy(),
  };
});

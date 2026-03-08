import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterPills } from "./FilterPills";
import { useAppStore } from "../lib/store";

// Mock the store
vi.mock("../lib/store", () => ({
  useAppStore: vi.fn(),
}));

describe("FilterPills", () => {
  const mockSetFilter = vi.fn();

  beforeEach(() => {
    vi.mocked(useAppStore).mockImplementation((selector) => {
      const state = {
        filter: "all" as const,
        setFilter: mockSetFilter,
      };
      return selector(state as ReturnType<typeof useAppStore>);
    });
    mockSetFilter.mockClear();
  });

  it("renders all three filter pills with counts", () => {
    render(<FilterPills counts={{ all: 10, enabled: 6, disabled: 4 }} />);
    expect(screen.getByText("All (10)")).toBeInTheDocument();
    expect(screen.getByText("Enabled (6)")).toBeInTheDocument();
    expect(screen.getByText("Disabled (4)")).toBeInTheDocument();
  });

  it("calls setFilter when a pill is clicked", () => {
    render(<FilterPills counts={{ all: 10, enabled: 6, disabled: 4 }} />);
    fireEvent.click(screen.getByText("Enabled (6)"));
    expect(mockSetFilter).toHaveBeenCalledWith("enabled");
  });
});

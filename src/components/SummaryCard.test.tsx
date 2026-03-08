import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SummaryCard } from "./SummaryCard";

describe("SummaryCard", () => {
  it("renders title, enabled count, and total", () => {
    render(<SummaryCard title="ACTIVE AGENTS" enabled={3} total={5} color="#4fc3f7" />);
    expect(screen.getByText("ACTIVE AGENTS")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("/ 5 total")).toBeInTheDocument();
  });

  it("calculates percentage correctly", () => {
    render(<SummaryCard title="TEST" enabled={2} total={4} color="#4fc3f7" />);
    expect(screen.getByText("50% enabled")).toBeInTheDocument();
  });

  it("shows 0% when total is 0", () => {
    render(<SummaryCard title="TEST" enabled={0} total={0} color="#4fc3f7" />);
    expect(screen.getByText("0% enabled")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<SummaryCard title="TEST" enabled={1} total={2} color="#4fc3f7" onClick={onClick} />);
    fireEvent.click(screen.getByText("TEST"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies ring style when active", () => {
    const { container } = render(
      <SummaryCard title="TEST" enabled={1} total={2} color="#4fc3f7" active />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("ring-2");
    expect(card.style.boxShadow).toContain("#4fc3f7");
  });
});

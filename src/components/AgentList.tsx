import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { AgentInfo } from "../bindings";
import { useAppStore, type Section } from "../lib/store";
import { AgentGroup } from "./AgentGroup";
import { EmptyState } from "./EmptyState";

export function AgentList() {
  const activeSection = useAppStore((s) => s.activeSection);
  const items: AgentInfo[] = useAppStore(
    (s) => s[activeSection as Section],
  );
  const searchQuery = useAppStore((s) => s.searchQuery);
  const filter = useAppStore((s) => s.filter);
  const loading = useAppStore((s) => s.loading);

  const filtered = useMemo(() => {
    let result = items;

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q)),
      );
    }

    // Apply filter
    if (filter === "enabled") {
      result = result.filter((i) => i.enabled);
    } else if (filter === "disabled") {
      result = result.filter((i) => !i.enabled);
    }

    return result;
  }, [items, searchQuery, filter]);

  // Group items
  const groups = useMemo(() => {
    const map = new Map<string, AgentInfo[]>();
    for (const item of filtered) {
      const group = item.group || "Custom";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }

    // Sort: named groups alphabetically, Custom last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Custom" && b !== "Custom") return 1;
      if (b === "Custom" && a !== "Custom") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#555577]" />
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState section={activeSection} />;
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#555577]">
        No matches for "{searchQuery}"
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {groups.map(([groupName, groupItems]) => (
        <AgentGroup key={groupName} groupName={groupName} items={groupItems} />
      ))}
    </div>
  );
}

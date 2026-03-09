import { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Plus, Check, Info } from "lucide-react";
import type { AgentInfo } from "../bindings";
import { useAppStore } from "../lib/store";
import { useEscapeKey } from "../lib/useEscapeKey";
import { AgentCard } from "./AgentCard";

interface AgentGroupProps {
  groupName: string;
  items: AgentInfo[];
}

const sessionWarnedGroups = new Set<string>();

export function AgentGroup({ groupName, items }: AgentGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const setupIds = useAppStore((s) => s.setupIds);
  const addToSetup = useAppStore((s) => s.addToSetup);
  const skipGroupWarnings = useAppStore((s) => s.skipGroupWarnings);
  const [warnedGroups, setWarnedGroups] = useState<Set<string>>(() => new Set(sessionWarnedGroups));
  const [pendingItem, setPendingItem] = useState<AgentInfo | null>(null);

  useEscapeKey(useCallback(() => {
    if (pendingItem) setPendingItem(null);
  }, [pendingItem]));

  const allInSetup = items.every((i) => setupIds.has(i.id));
  const handleAddAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const item of items) {
      if (!setupIds.has(item.id)) {
        addToSetup(item.id);
      }
    }
  };

  const handleAddToSetup = (item: AgentInfo) => {
    const group = item.group || "Custom";
    if (group !== "Custom" && items.length > 1 && !skipGroupWarnings && !warnedGroups.has(group)) {
      // Check if not all items are already in setup (adding individually)
      const othersInSetup = items.filter((i) => i.id !== item.id).every((i) => setupIds.has(i.id));
      if (!othersInSetup) {
        setPendingItem(item);
        return;
      }
    }
    addToSetup(item.id);
  };

  const confirmAddOne = () => {
    if (!pendingItem) return;
    const group = pendingItem.group || "Custom";
    sessionWarnedGroups.add(group);
    setWarnedGroups((prev) => new Set(prev).add(group));
    addToSetup(pendingItem.id);
    setPendingItem(null);
  };

  const confirmAddAll = () => {
    if (!pendingItem) return;
    const group = pendingItem.group || "Custom";
    sessionWarnedGroups.add(group);
    setWarnedGroups((prev) => new Set(prev).add(group));
    for (const item of items) {
      if (!setupIds.has(item.id)) {
        addToSetup(item.id);
      }
    }
    setPendingItem(null);
  };

  return (
    <div className="mb-3">
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#313138]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#6b6b78]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#6b6b78]" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8a96]">
          {groupName}
        </span>
        <span className="text-xs text-[#56565f]">({items.length})</span>
        <div className="flex-1" />
        {items.length > 1 && (allInSetup ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-[#00d4aa]">
            <Check className="h-3 w-3" />
            All in Setup
          </span>
        ) : (
          <button
            onClick={handleAddAll}
            className="flex items-center gap-1 rounded-md border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-2.5 py-1 text-[11px] font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
          >
            <Plus className="h-3 w-3" />
            Add All to Setup
          </button>
        ))}
      </div>
      {expanded && (
        <div className="mt-1 flex flex-col gap-1.5 pl-6">
          {items.map((item) => (
            <AgentCard key={item.id} item={item} onAddToSetup={handleAddToSetup} />
          ))}
        </div>
      )}

      {/* Group info modal */}
      {pendingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-[380px] flex-col gap-4 rounded-lg border border-[#3a3a42] bg-[#27272c] p-5 shadow-xl">
            <div className="flex items-center gap-2.5">
              <Info className="h-5 w-5 shrink-0 text-[#4fc3f7]" />
              <h3 className="text-sm font-semibold text-[#e8e8ec]">
                Part of a group
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-[#8a8a96]">
              <span className="font-semibold text-[#e8e8ec]">{pendingItem.name}</span>{" "}
              belongs to the{" "}
              <span className="font-semibold text-[#e8e8ec]">{groupName}</span>{" "}
              group. Adding items individually may affect how this group works.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingItem(null)}
                className="rounded px-3 py-1.5 text-xs text-[#8a8a96] hover:text-[#e8e8ec]"
              >
                Cancel
              </button>
              <button
                onClick={confirmAddOne}
                className="rounded border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-3 py-1.5 text-xs font-medium text-[#4fc3f7] hover:bg-[#4fc3f7]/20"
              >
                Add This One
              </button>
              <button
                onClick={confirmAddAll}
                className="rounded bg-[#4fc3f7] px-3 py-1.5 text-xs font-medium text-[#1e1e23] hover:bg-[#4fc3f7]/80"
              >
                Add Entire Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

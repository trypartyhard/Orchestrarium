import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Check } from "lucide-react";
import type { AgentInfo } from "../bindings";
import { useAppStore } from "../lib/store";
import { AgentCard } from "./AgentCard";

interface AgentGroupProps {
  groupName: string;
  items: AgentInfo[];
}

export function AgentGroup({ groupName, items }: AgentGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const setupIds = useAppStore((s) => s.setupIds);
  const addToSetup = useAppStore((s) => s.addToSetup);

  const allInSetup = items.every((i) => setupIds.has(i.id));
  const handleAddAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const item of items) {
      if (!setupIds.has(item.id)) {
        addToSetup(item.id);
      }
    }
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
            <AgentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AgentInfo } from "../bindings";
import { useAppStore } from "../lib/store";
import { Toggle } from "./Toggle";
import { AgentCard } from "./AgentCard";

interface AgentGroupProps {
  groupName: string;
  items: AgentInfo[];
}

export function AgentGroup({ groupName, items }: AgentGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const toggleGroup = useAppStore((s) => s.toggleGroup);

  const allEnabled = items.every((i) => i.enabled);
  const someEnabled = items.some((i) => i.enabled);

  const handleGroupToggle = () => {
    const targetState = !allEnabled;
    toggleGroup(items, targetState);
  };

  return (
    <div className="mb-3">
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#22223a]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#555577]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#555577]" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8888aa]">
          {groupName}
        </span>
        <span className="text-xs text-[#555577]">({items.length})</span>
        <div className="flex-1" />
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle
            enabled={allEnabled}
            onToggle={handleGroupToggle}
            disabled={!someEnabled && allEnabled}
          />
        </div>
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

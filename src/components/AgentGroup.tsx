import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
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
          {[...items]
            .sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1))
            .map((item) => (
              <motion.div
                key={item.id}
                layout
                animate={{ opacity: item.enabled ? 1 : 0.5 }}
                transition={{
                  layout: { duration: 0.3, ease: "easeInOut" },
                  opacity: { duration: 0.3, ease: "easeInOut" },
                }}
              >
                <AgentCard item={item} />
              </motion.div>
            ))}
        </div>
      )}
    </div>
  );
}

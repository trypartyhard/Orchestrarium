import { Plus, Check } from "lucide-react";
import type { AgentInfo } from "../bindings";
import { useAppStore } from "../lib/store";
import { ColorDot } from "./ColorDot";
import { Badge } from "./Badge";

interface AgentCardProps {
  item: AgentInfo;
}

export function AgentCard({ item }: AgentCardProps) {
  const setupIds = useAppStore((s) => s.setupIds);
  const addToSetup = useAppStore((s) => s.addToSetup);
  const inSetup = setupIds.has(item.id);

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 py-2.5 transition-colors hover:bg-[#313138]"
    >
      <ColorDot color={item.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[#dddde4]">
            {item.name}
          </span>
          <Badge
            text={item.scope}
            variant={item.scope === "global" ? "info" : "project"}
          />
          {item.invalid_config && <Badge text="invalid config" variant="error" />}
        </div>
        {item.description && (
          <p className="truncate text-xs text-[#56565f]">{item.description}</p>
        )}
      </div>
      {inSetup ? (
        <span className="flex items-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 text-xs font-medium text-[#00d4aa]">
          <Check className="h-3 w-3" />
          In Setup
        </span>
      ) : (
        <button
          onClick={() => addToSetup(item.id)}
          className="flex items-center gap-1.5 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-3 py-1.5 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
        >
          <Plus className="h-3 w-3" />
          Add to Setup
        </button>
      )}
    </div>
  );
}

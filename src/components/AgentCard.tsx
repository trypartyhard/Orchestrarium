import type { AgentInfo } from "../bindings";
import { useAppStore } from "../lib/store";
import { Toggle } from "./Toggle";
import { ColorDot } from "./ColorDot";
import { Badge } from "./Badge";

interface AgentCardProps {
  item: AgentInfo;
}

export function AgentCard({ item }: AgentCardProps) {
  const toggleItem = useAppStore((s) => s.toggleItem);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-[#2a2a44] bg-[#1a1a2e] px-3 py-2.5 transition-colors hover:bg-[#22223a] ${
        !item.enabled ? "opacity-50" : ""
      }`}
    >
      <ColorDot color={item.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[#d0d0e8]">
            {item.name}
          </span>
          {item.invalid_config && <Badge text="invalid config" variant="error" />}
        </div>
        {item.description && (
          <p className="truncate text-xs text-[#555577]">{item.description}</p>
        )}
      </div>
      <Toggle enabled={item.enabled} onToggle={() => toggleItem(item)} />
    </div>
  );
}

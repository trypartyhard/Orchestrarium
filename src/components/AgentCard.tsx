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
      <Toggle enabled={item.enabled} onToggle={() => toggleItem(item)} />
    </div>
  );
}

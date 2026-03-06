import type { AgentInfo } from "../bindings";
import { ColorDot } from "./ColorDot";

interface ActiveItemsListProps {
  title: string;
  items: AgentInfo[];
  color: string;
  maxVisible?: number;
  showGroup?: boolean;
}

export function ActiveItemsList({
  title,
  items,
  color,
  maxVisible = 100,
  showGroup = false,
}: ActiveItemsListProps) {
  const enabled = items.filter((i) => i.enabled);
  const visible = enabled.slice(0, maxVisible);
  const remaining = enabled.length - visible.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-semibold text-[#cdcdd6]">{title}</span>
        <span className="text-xs text-[#56565f]">{enabled.length} enabled</span>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {visible.length === 0 ? (
          <span className="py-3 text-center text-xs text-[#56565f]">
            No active items
          </span>
        ) : (
          visible.map((item, idx) => (
            <div
              key={item.id}
              className={`flex h-9 items-center gap-3 rounded-md px-4 ${
                idx % 2 === 0 ? "bg-[#313138]" : "bg-[#2b2b30]"
              }`}
            >
              <ColorDot color={item.color} />
              <span className="text-[13px] font-medium text-[#dddde4]">
                {item.name}
              </span>
              {item.description && (
                <span className="truncate text-[11px] text-[#56565f]">
                  {item.description}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {showGroup && item.group && item.group !== "Custom" && (
                  <span
                    className="rounded-[3px] px-2.5 py-0.5 font-mono text-[9px]"
                    style={{
                      backgroundColor: `${color}08`,
                      color: color,
                    }}
                  >
                    {item.group}
                  </span>
                )}
                {!showGroup && (
                  <span
                    className="rounded-[3px] px-2.5 py-0.5 font-mono text-[9px]"
                    style={{
                      backgroundColor:
                        item.scope === "project"
                          ? "rgba(255,167,38,0.08)"
                          : "rgba(102,187,106,0.08)",
                      color:
                        item.scope === "project" ? "#ffa726" : "#66bb6a",
                    }}
                  >
                    {item.scope}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
        {remaining > 0 && (
          <span className="py-2 text-center text-xs text-[#56565f]">
            + {remaining} more {title.toLowerCase().replace("active ", "")}
          </span>
        )}
      </div>
    </div>
  );
}

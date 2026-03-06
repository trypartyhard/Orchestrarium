import type { AgentInfo } from "../bindings";

interface CommandPillsProps {
  title: string;
  items: AgentInfo[];
  color: string;
}

export function CommandPills({ title, items, color }: CommandPillsProps) {
  const enabled = items.filter((i) => i.enabled);

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

      {/* Horizontal pills */}
      <div className="flex flex-wrap gap-2">
        {enabled.length === 0 ? (
          <span className="py-3 text-xs text-[#56565f]">No active commands</span>
        ) : (
          enabled.map((item) => (
            <div
              key={item.id}
              className="flex h-8 items-center rounded-md bg-[#313138] px-4"
            >
              <span className="font-mono text-xs text-[#4fc3f7]">
                {item.name.startsWith("/") ? item.name : `/${item.name}`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  enabled: number;
  total: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}

export function SummaryCard({ title, enabled, total, color, active, onClick }: SummaryCardProps) {
  const pct = total > 0 ? Math.round((enabled / total) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className={`flex flex-1 cursor-pointer items-center justify-between rounded-[10px] bg-[#27272c] px-5 py-4 transition-colors hover:bg-[#313138] ${
        active ? "ring-2" : ""
      }`}
      style={active ? { boxShadow: `0 0 0 2px ${color}` } : undefined}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[#7a7a88]">{title}</span>
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="text-[32px] font-bold leading-none" style={{ color }}>
            {enabled}
          </span>
          <span className="text-sm text-[#56565f]">/ {total} total</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-1.5 w-[130px] overflow-hidden rounded-full bg-[#3a3a42]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
          />
        </div>
        <span className="text-[11px] text-[#56565f]">{pct}% enabled</span>
      </div>
    </div>
  );
}

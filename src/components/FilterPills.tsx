import { useAppStore, type Filter } from "../lib/store";

interface FilterPillsProps {
  counts: { all: number; enabled: number; disabled: number };
}

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "enabled", label: "Enabled" },
  { key: "disabled", label: "Disabled" },
];

export function FilterPills({ counts }: FilterPillsProps) {
  const activeFilter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);

  return (
    <div className="flex gap-1">
      {filters.map(({ key, label }) => {
        const count = counts[key];
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              isActive
                ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                : "text-[#555577] hover:text-[#8888aa]"
            }`}
          >
            {label} ({count})
          </button>
        );
      })}
    </div>
  );
}

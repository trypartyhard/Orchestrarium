import { SearchBar } from "./SearchBar";
import { FilterPills } from "./FilterPills";
import { useAppStore, type ItemSection } from "../lib/store";
import type { AgentInfo } from "../bindings";

export function Header() {
  const activeSection = useAppStore((s) => s.activeSection);
  const items: AgentInfo[] = useAppStore(
    (s) => s[activeSection as ItemSection] ?? [],
  );

  const counts = {
    all: items.length,
    enabled: items.filter((i) => i.enabled).length,
    disabled: items.filter((i) => !i.enabled).length,
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#3a3a42] px-4">
      <SearchBar />
      <FilterPills counts={counts} />
    </header>
  );
}

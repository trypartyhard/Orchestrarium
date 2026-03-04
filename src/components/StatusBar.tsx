import { useAppStore, type Section } from "../lib/store";
import type { AgentInfo } from "../bindings";

export function StatusBar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const items: AgentInfo[] = useAppStore(
    (s) => s[activeSection as Section],
  );

  const enabledCount = items.filter((i) => i.enabled).length;
  const disabledCount = items.filter((i) => !i.enabled).length;

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[#2a2a44] px-4 text-[11px] text-[#555577]">
      <span>~/.claude</span>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#00d4aa]" />
          {enabledCount} enabled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#555577]" />
          {disabledCount} disabled
        </span>
      </div>
      <span>v0.1.0</span>
    </footer>
  );
}

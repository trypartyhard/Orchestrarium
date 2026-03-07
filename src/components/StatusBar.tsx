import { useAppStore } from "../lib/store";

export function StatusBar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const agents = useAppStore((s) => s.agents);
  const skills = useAppStore((s) => s.skills);
  const commands = useAppStore((s) => s.commands);

  const items =
    activeSection === "setup"
      ? [...agents, ...skills, ...commands]
      : activeSection === "agents"
        ? agents
        : activeSection === "skills"
          ? skills
          : commands;

  const enabledCount = items.filter((i) => i.enabled).length;
  const disabledCount = items.filter((i) => !i.enabled).length;

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-[#222228] bg-[#111116] px-4 font-mono text-[11px] text-[#56565f]">
      <span>~/.claude/agents/</span>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4fc3f7]" />
          <span className="text-[#6b6b78]">{enabledCount} active</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7a7a88]" />
          <span className="text-[#6b6b78]">{disabledCount} disabled</span>
        </span>
      </div>
      <span>v0.2.0</span>
    </footer>
  );
}

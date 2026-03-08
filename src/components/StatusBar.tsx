import { useAppStore } from "../lib/store";

export function StatusBar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const agents = useAppStore((s) => s.agents);
  const skills = useAppStore((s) => s.skills);
  const commands = useAppStore((s) => s.commands);
  const setups = useAppStore((s) => s.setups);
  const claudeProfiles = useAppStore((s) => s.claudeProfiles);

  const isItemSection = activeSection === "setup" || activeSection === "agents" || activeSection === "skills" || activeSection === "commands";

  const items =
    activeSection === "setup"
      ? [...agents, ...skills, ...commands]
      : activeSection === "agents"
        ? agents
        : activeSection === "skills"
          ? skills
          : commands;

  const enabledCount = isItemSection ? items.filter((i) => i.enabled).length : 0;
  const disabledCount = isItemSection ? items.filter((i) => !i.enabled).length : 0;

  const pathLabel =
    activeSection === "library"
      ? "~/.claude/cam/setups.json"
      : activeSection === "claude-md"
        ? "~/.claude/CLAUDE.md"
        : activeSection === "setup"
          ? "~/.claude/"
          : activeSection === "skills"
            ? "~/.claude/skills/"
            : activeSection === "commands"
              ? "~/.claude/commands/"
              : "~/.claude/agents/";

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-[#222228] bg-[#111116] px-4 font-mono text-[11px] text-[#56565f]">
      <span>{pathLabel}</span>
      <div className="flex items-center gap-4">
        {activeSection === "library" ? (
          <span className="text-[#6b6b78]">{setups.length} setup{setups.length !== 1 ? "s" : ""} saved</span>
        ) : activeSection === "claude-md" ? (
          <span className="text-[#6b6b78]">{claudeProfiles.length} profile{claudeProfiles.length !== 1 ? "s" : ""}</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4fc3f7]" />
              <span className="text-[#6b6b78]">{enabledCount} active</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#7a7a88]" />
              <span className="text-[#6b6b78]">{disabledCount} disabled</span>
            </span>
          </>
        )}
      </div>
      <span>v0.2.0</span>
    </footer>
  );
}

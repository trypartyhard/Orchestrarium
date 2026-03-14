import { useAppStore } from "../lib/store";

export function StatusBar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const agents = useAppStore((s) => s.agents);
  const skills = useAppStore((s) => s.skills);
  const commands = useAppStore((s) => s.commands);
  const mcpServers = useAppStore((s) => s.mcpServers);
  const setups = useAppStore((s) => s.setups);
  const claudeProfiles = useAppStore((s) => s.claudeProfiles);
  const activeContext = useAppStore((s) => s.activeContext);
  const projectDir = useAppStore((s) => s.projectDir);

  const isItemSection =
    activeSection === "setup"
    || activeSection === "agents"
    || activeSection === "skills"
    || activeSection === "commands"
    || activeSection === "mcp";

  const items =
    activeSection === "setup"
      ? [...agents, ...skills, ...commands]
      : activeSection === "agents"
        ? agents
        : activeSection === "skills"
          ? skills
          : activeSection === "commands"
            ? commands
            : mcpServers;

  const enabledCount = isItemSection ? items.filter((i) => i.enabled).length : 0;
  const disabledCount = isItemSection ? items.filter((i) => !i.enabled).length : 0;

  const basePath = activeContext === "project" && projectDir
    ? projectDir.replace(/\\/g, "/").replace(/\/$/, "")
    : "~/.claude";

  const pathLabel =
    activeSection === "library"
      ? activeContext === "project" && projectDir
        ? `${basePath}/.claude/orchestrarium/setups.json`
        : "~/.claude/orchestrarium/setups.json"
      : activeSection === "claude-md"
        ? activeContext === "project" && projectDir
          ? `${basePath}/CLAUDE.md`
          : "~/.claude/CLAUDE.md"
        : activeSection === "mcp"
          ? activeContext === "project" && projectDir
            ? `${basePath}/.mcp.json + ~/.claude.json`
            : "~/.claude.json"
        : activeSection === "setup"
          ? activeContext === "project" && projectDir
            ? `${basePath}/.claude/`
            : "~/.claude/"
          : activeSection === "skills"
            ? `${basePath}${activeContext === "project" ? "/.claude" : ""}/skills/`
            : activeSection === "commands"
              ? `${basePath}${activeContext === "project" ? "/.claude" : ""}/commands/`
              : `${basePath}${activeContext === "project" ? "/.claude" : ""}/agents/`;

  const projectName = activeContext === "project" && projectDir
    ? projectDir.replace(/\\/g, "/").replace(/\/$/, "").split("/").pop()
    : null;
  const contextLabel = activeContext === "project" ? (projectName ? `Project "${projectName}"` : "Project") : "Global";
  const contextColor = activeContext === "project" ? "#ffa726" : "#4fc3f7";

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between bg-[#111116] px-4 font-mono text-[11px] text-[#56565f]">
      <div className="flex items-center gap-2">
        <span style={{ color: contextColor }}>{contextLabel}</span>
        <span className="text-[#3a3a42]">|</span>
        <span>{pathLabel}</span>
      </div>
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
      <span>v{__APP_VERSION__}</span>
    </footer>
  );
}

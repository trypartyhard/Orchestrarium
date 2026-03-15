import { useState } from "react";
import { LayoutDashboard, Bot, Sparkles, Terminal, Plug, Library, FileText, Settings, BookOpen, Globe, FolderOpen, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore, type Section } from "../lib/store";
import { TutorialModal } from "./TutorialModal";
import { SettingsModal } from "./SettingsModal";

const sections: { key: Section; label: string; icon: typeof Bot }[] = [
  { key: "setup", label: "Setup", icon: LayoutDashboard },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "skills", label: "Skills", icon: Sparkles },
  { key: "commands", label: "Commands", icon: Terminal },
  { key: "library", label: "Library", icon: Library },
  { key: "claude-md", label: "CLAUDE.md", icon: FileText },
  { key: "mcp", label: "MCP Servers", icon: Plug },
];

export function Sidebar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const loadSection = useAppStore((s) => s.loadSection);
  const activeContext = useAppStore((s) => s.activeContext);
  const projectDir = useAppStore((s) => s.projectDir);
  const setActiveContext = useAppStore((s) => s.setActiveContext);
  const setProjectDir = useAppStore((s) => s.setProjectDir);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleClick = (section: Section) => {
    setActiveSection(section);
    loadSection(section);
  };

  const handleOpenProject = async () => {
    const selected = await open({ directory: true });
    if (selected) {
      await setProjectDir(selected);
      if (activeContext !== "project") {
        await setActiveContext("project");
      }
    }
  };

  const handleClearProject = async () => {
    await setProjectDir(null);
  };

  const projectName = projectDir
    ? projectDir.replace(/\\/g, "/").split("/").pop() || projectDir
    : null;

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center bg-[#111116]">
      {/* Context switcher */}
      <div className="flex w-full flex-col items-center gap-1 border-b border-[#222228] pb-2 pt-3">
        <div className="flex gap-0.5 rounded-lg bg-[#1e1e23] p-0.5">
          <button
            onClick={() => setActiveContext("global")}
            title="Global context (~/.claude)"
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
              activeContext === "global"
                ? "bg-[#4fc3f7]/20 text-[#4fc3f7]"
                : "text-[#56565f] hover:text-[#8a8a96]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (activeContext !== "project") {
                if (projectDir) {
                  setActiveContext("project");
                } else {
                  handleOpenProject();
                }
              }
            }}
            title={projectDir ? `Project: ${projectName}` : "Open project"}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
              activeContext === "project"
                ? "bg-[#ffa726]/20 text-[#ffa726]"
                : "text-[#56565f] hover:text-[#8a8a96]"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
        {activeContext === "project" && projectDir && (
          <div className="group relative flex w-full items-center justify-center px-1">
            <span
              title={projectDir}
              className="max-w-[52px] truncate text-center text-[9px] text-[#ffa726]"
            >
              {projectName}
            </span>
            <button
              onClick={handleClearProject}
              title="Clear project"
              className="absolute right-0.5 hidden h-3 w-3 items-center justify-center rounded text-[#56565f] hover:text-[#e8e8ec] group-hover:flex"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col items-center gap-[14px] pt-4">
        {sections.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              title={label}
              aria-label={label}
              className="group relative flex h-10 w-10 items-center justify-center"
            >
              {isActive && (
                <span className="absolute left-[-12px] top-[6px] h-7 w-[3px] rounded-r-[1.5px] bg-[#4fc3f7]" />
              )}
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${
                  isActive
                    ? "bg-[#2a2a32] ring-[1.5px] ring-[#4fc3f7]/50"
                    : "text-[#6b6b78] hover:bg-[#2a2a32] hover:text-[#8a8a96]"
                }`}
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  style={isActive ? { color: "#4fc3f7" } : undefined}
                />
              </span>
              <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded bg-[#3a3a42] px-2 py-1 text-xs text-[#e8e8ec] shadow-lg group-hover:block">
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="flex flex-col items-center gap-2 pb-5">
        {activeContext === "project" && (
          <button
            onClick={handleOpenProject}
            title="Change project folder"
            aria-label="Change project folder"
            className="group relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#ffa726]"
          >
            <FolderOpen className="h-[18px] w-[18px]" />
            <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded bg-[#3a3a42] px-2 py-1 text-xs text-[#e8e8ec] shadow-lg group-hover:block">
              Change Project
            </span>
          </button>
        )}
        <button
          onClick={() => setShowTutorial(true)}
          title="Tutorial"
          aria-label="Open tutorial"
          className="group relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#8a8a96]"
        >
          <BookOpen className="h-[18px] w-[18px]" />
          <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded bg-[#3a3a42] px-2 py-1 text-xs text-[#e8e8ec] shadow-lg group-hover:block">
            Tutorial
          </span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          aria-label="Open settings"
          className="group relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#8a8a96]"
        >
          <Settings className="h-[18px] w-[18px]" />
          <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded bg-[#3a3a42] px-2 py-1 text-xs text-[#e8e8ec] shadow-lg group-hover:block">
            Settings
          </span>
        </button>
      </div>
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
  );
}

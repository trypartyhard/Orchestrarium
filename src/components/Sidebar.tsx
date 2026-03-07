import { useState } from "react";
import { LayoutDashboard, Bot, Sparkles, Terminal, BookOpen } from "lucide-react";
import { useAppStore, type Section } from "../lib/store";
import { TutorialModal } from "./TutorialModal";

const sections: { key: Section; label: string; icon: typeof Bot }[] = [
  { key: "setup", label: "Setup", icon: LayoutDashboard },
  { key: "agents", label: "Agents", icon: Bot },
  { key: "skills", label: "Skills", icon: Sparkles },
  { key: "commands", label: "Commands", icon: Terminal },
];

export function Sidebar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const loadSection = useAppStore((s) => s.loadSection);
  const [showTutorial, setShowTutorial] = useState(false);

  const handleClick = (section: Section) => {
    setActiveSection(section);
    loadSection(section);
  };

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center bg-[#111116]">
      <nav className="flex flex-1 flex-col items-center gap-[14px] pt-5">
        {sections.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              title={label}
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
      <div className="pb-5">
        <button
          onClick={() => setShowTutorial(true)}
          title="Tutorial"
          className="group relative flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#8a8a96]"
        >
          <BookOpen className="h-[18px] w-[18px]" />
          <span className="pointer-events-none absolute left-14 z-50 hidden whitespace-nowrap rounded bg-[#3a3a42] px-2 py-1 text-xs text-[#e8e8ec] shadow-lg group-hover:block">
            Tutorial
          </span>
        </button>
      </div>
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </aside>
  );
}

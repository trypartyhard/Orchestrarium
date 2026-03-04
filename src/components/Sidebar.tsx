import { Users, Sparkles, Terminal } from "lucide-react";
import { useAppStore, type Section } from "../lib/store";

const sections: { key: Section; label: string; icon: typeof Users }[] = [
  { key: "agents", label: "Agents", icon: Users },
  { key: "skills", label: "Skills", icon: Sparkles },
  { key: "commands", label: "Commands", icon: Terminal },
];

export function Sidebar() {
  const activeSection = useAppStore((s) => s.activeSection);
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const loadSection = useAppStore((s) => s.loadSection);
  const agents = useAppStore((s) => s.agents);
  const skills = useAppStore((s) => s.skills);
  const commands = useAppStore((s) => s.commands);

  const counts: Record<Section, number> = {
    agents: agents.length,
    skills: skills.length,
    commands: commands.length,
  };

  const handleClick = (section: Section) => {
    setActiveSection(section);
    loadSection(section);
  };

  return (
    <aside className="flex h-full w-[200px] shrink-0 flex-col border-r border-[#2a2a44] bg-[#1a1a2e]">
      <div className="flex h-12 items-center px-4">
        <span className="text-sm font-bold tracking-wider text-[#00d4aa]">
          CAM
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
        {sections.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => handleClick(key)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "border-l-2 border-[#00d4aa] bg-[#22223a] text-[#d0d0e8]"
                  : "border-l-2 border-transparent text-[#555577] hover:bg-[#22223a] hover:text-[#8888aa]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{label}</span>
              {counts[key] > 0 && (
                <span className="text-xs text-[#555577]">{counts[key]}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

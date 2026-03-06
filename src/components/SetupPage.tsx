import { useState, useEffect, useMemo } from "react";
import { Download, Upload, Save, Trash2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../lib/store";
import { SummaryCard } from "./SummaryCard";
import { Toggle } from "./Toggle";
import { ColorDot } from "./ColorDot";
import type { AgentInfo } from "../bindings";

export function SetupPage() {
  const agents = useAppStore((s) => s.agents);
  const skills = useAppStore((s) => s.skills);
  const commands = useAppStore((s) => s.commands);
  const toggleItem = useAppStore((s) => s.toggleItem);
  const createSetup = useAppStore((s) => s.createSetup);
  const exportSetup = useAppStore((s) => s.exportSetup);
  const importSetup = useAppStore((s) => s.importSetup);
  const showToast = useAppStore((s) => s.showToast);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Track which item IDs are part of the setup (initially = all enabled)
  const [setupIds, setSetupIds] = useState<Set<string>>(new Set());

  const allItems = useMemo(
    () => [...agents, ...skills, ...commands],
    [agents, skills, commands],
  );

  // Initialize setupIds with currently enabled items on first render
  useEffect(() => {
    const enabledIds = allItems.filter((i) => i.enabled).map((i) => i.id);
    setSetupIds(new Set(enabledIds));
  }, []);

  // Setup list is independent — items are NOT auto-added/removed
  // when toggled from Agents/Skills/Commands sections

  // Items visible in setup list, grouped by type
  const setupItems = allItems.filter((i) => setupIds.has(i.id));
  const agentIds = new Set(agents.map((a) => a.id));
  const skillIds = new Set(skills.map((s) => s.id));
  const sortEnabledFirst = (a: AgentInfo, b: AgentInfo) =>
    a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1;
  const setupAgents = setupItems.filter((i) => agentIds.has(i.id)).sort(sortEnabledFirst);
  const setupSkills = setupItems.filter((i) => skillIds.has(i.id)).sort(sortEnabledFirst);
  const setupCommands = setupItems
    .filter((i) => !agentIds.has(i.id) && !skillIds.has(i.id))
    .sort(sortEnabledFirst);

  const stats = {
    agents: { enabled: agents.filter((a) => a.enabled).length, total: agents.length },
    skills: { enabled: skills.filter((s) => s.enabled).length, total: skills.length },
    commands: { enabled: commands.filter((c) => c.enabled).length, total: commands.length },
  };

  const handleExport = async () => {
    const name = `snapshot-${Date.now()}`;
    await createSetup(name);
    const json = await exportSetup(name);
    if (!json) return;

    const path = await save({
      defaultPath: "setup.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (path) {
      try {
        await writeTextFile(path, json);
      } catch {
        showToast("Failed to write file");
      }
    }
  };

  const handleImport = async () => {
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (path) {
      try {
        const content = await readTextFile(path);
        await importSetup(content);
      } catch {
        showToast("Failed to read file");
      }
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    await createSetup(saveName.trim());
    setSaveName("");
    setShowSaveModal(false);
  };

  const handleRemoveFromSetup = async (item: AgentInfo) => {
    // Remove from setup list
    setSetupIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    // Disable if currently enabled
    if (item.enabled) {
      await toggleItem(item);
    }
  };

  const btnClass =
    "flex h-[34px] items-center gap-2 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20";

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e8e8ec]">Setup</h1>
          <p className="text-[13px] text-[#7a7a88]">
            Your current active configuration at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className={btnClass}>
            <Download className="h-3.5 w-3.5" />
            Export Setup
          </button>
          <button onClick={handleImport} className={btnClass}>
            <Upload className="h-3.5 w-3.5" />
            Import Setup
          </button>
          <button onClick={() => setShowSaveModal(true)} className={btnClass}>
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex gap-4">
        <SummaryCard
          title="ACTIVE AGENTS"
          enabled={stats.agents.enabled}
          total={stats.agents.total}
          color="#4fc3f7"
        />
        <SummaryCard
          title="ACTIVE SKILLS"
          enabled={stats.skills.enabled}
          total={stats.skills.total}
          color="#66bb6a"
        />
        <SummaryCard
          title="ACTIVE COMMANDS"
          enabled={stats.commands.enabled}
          total={stats.commands.total}
          color="#ffa726"
        />
      </div>

      {/* Setup items list grouped by type */}
      {setupItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#56565f]">
          No items in setup
        </div>
      ) : (
        <LayoutGroup>
          <div className="flex flex-col gap-4">
            {([
              { label: "Agents", items: setupAgents, color: "#4fc3f7" },
              { label: "Skills", items: setupSkills, color: "#66bb6a" },
              { label: "Commands", items: setupCommands, color: "#ffa726" },
            ] as const).filter((g) => g.items.length > 0).map((group) => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#56565f]">
                  {group.label}
                </h3>
                <AnimatePresence>
                  {group.items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: item.enabled ? 1 : 0.5, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 py-2.5 hover:bg-[#313138]"
                    >
                      <ColorDot color={item.color} />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-[#dddde4]">
                          {item.name}
                        </span>
                        {item.description && (
                          <p className="truncate text-xs text-[#56565f]">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <Toggle
                        enabled={item.enabled}
                        onToggle={() => toggleItem(item)}
                      />
                      <button
                        onClick={() => handleRemoveFromSetup(item)}
                        title="Remove from setup"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </LayoutGroup>
      )}

      {/* Save modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-80 flex-col gap-4 rounded-lg border border-[#3a3a42] bg-[#27272c] p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e8e8ec]">
              Save Setup
            </h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Setup name..."
              autoFocus
              className="h-9 rounded border border-[#3a3a42] bg-[#1e1e23] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#4fc3f7]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                }}
                className="rounded px-3 py-1.5 text-xs text-[#8a8a96] hover:text-[#e8e8ec]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="rounded bg-[#4fc3f7] px-3 py-1.5 text-xs font-medium text-[#1e1e23] hover:bg-[#4fc3f7]/80 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

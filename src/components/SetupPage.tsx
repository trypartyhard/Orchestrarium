import { useState, useEffect, useMemo, useCallback } from "react";
import { Save, Trash2, ChevronDown, ChevronRight, XCircle, AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "../lib/store";
import { SummaryCard } from "./SummaryCard";
import { Toggle } from "./Toggle";
import { ColorDot } from "./ColorDot";
import type { AgentInfo } from "../bindings";
import { useEscapeKey } from "../lib/useEscapeKey";
import { validateName } from "../lib/validateName";

export function SetupPage() {
  const agents = useAppStore((s) => s.agents);
  const skills = useAppStore((s) => s.skills);
  const commands = useAppStore((s) => s.commands);
  const showToast = useAppStore((s) => s.showToast);
  const setupIds = useAppStore((s) => s.setupIds);
  const syncSetupIds = useAppStore((s) => s.syncSetupIds);
  const removeFromSetup = useAppStore((s) => s.removeFromSetup);
  const toggleItem = useAppStore((s) => s.toggleItem);
  const toggleGroup = useAppStore((s) => s.toggleGroup);
  const createSetup = useAppStore((s) => s.createSetup);
  const clearSetup = useAppStore((s) => s.clearSetup);
  const skipGroupWarnings = useAppStore((s) => s.skipGroupWarnings);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<"agents" | "skills" | "commands" | null>(null);
  const [warnedGroups, setWarnedGroups] = useState<Set<string>>(new Set());
  const [pendingToggle, setPendingToggle] = useState<AgentInfo | null>(null);

  useEscapeKey(useCallback(() => {
    if (pendingToggle) setPendingToggle(null);
    else if (showSaveModal) { setShowSaveModal(false); setSaveName(""); }
    else if (showClearModal) setShowClearModal(false);
  }, [pendingToggle, showSaveModal, showClearModal]));

  const allItems = useMemo(
    () => [...agents, ...skills, ...commands],
    [agents, skills, commands],
  );

  // On first load, populate setup with currently enabled items
  useEffect(() => {
    syncSetupIds();
  }, [allItems]);

  // Items visible in setup list
  const setupItems = allItems.filter((i) => setupIds.has(i.id));
  const agentIds = new Set(agents.map((a) => a.id));
  const skillIds = new Set(skills.map((s) => s.id));
  const setupAgents = setupItems.filter((i) => agentIds.has(i.id));
  const setupSkills = setupItems.filter((i) => skillIds.has(i.id));
  const setupCommands = setupItems.filter((i) => !agentIds.has(i.id) && !skillIds.has(i.id));

  // Group items by group name, sorted stably by item name within each group
  function buildSubGroups(items: AgentInfo[]) {
    const map = new Map<string, AgentInfo[]>();
    for (const item of items) {
      const group = item.group || "Custom";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }
    // Sort items within each group by name (stable order regardless of disk state)
    for (const [, groupItems] of map) {
      groupItems.sort((a, b) => a.name.localeCompare(b.name));
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Custom" && b !== "Custom") return 1;
      if (b === "Custom" && a !== "Custom") return -1;
      return a.localeCompare(b);
    });
  }

  const agentSubGroups = useMemo(() => buildSubGroups(setupAgents), [setupAgents]);
  const skillSubGroups = useMemo(() => buildSubGroups(setupSkills), [setupSkills]);
  const commandSubGroups = useMemo(() => buildSubGroups(setupCommands), [setupCommands]);

  // Stats reflect setup state
  const stats = {
    agents: { enabled: setupAgents.filter((a) => a.enabled).length, total: setupAgents.length },
    skills: { enabled: setupSkills.filter((s) => s.enabled).length, total: setupSkills.length },
    commands: { enabled: setupCommands.filter((c) => c.enabled).length, total: setupCommands.length },
  };

  const handleToggleWithWarning = (item: AgentInfo) => {
    const group = item.group || "Custom";
    // Only warn when disabling, in a named group with multiple items, and not yet warned
    if (item.enabled && group !== "Custom" && !skipGroupWarnings && !warnedGroups.has(group)) {
      const groupItems = allItems.filter((i) => i.group === group);
      if (groupItems.length > 1) {
        setPendingToggle(item);
        return;
      }
    }
    toggleItem(item);
  };

  const confirmGroupWarning = () => {
    if (!pendingToggle) return;
    const group = pendingToggle.group || "Custom";
    setWarnedGroups((prev) => new Set(prev).add(group));
    toggleItem(pendingToggle);
    setPendingToggle(null);
  };

  const saveNameError = validateName(saveName);

  const handleSave = async () => {
    if (!saveName.trim() || saveNameError) return;
    await createSetup(saveName.trim());
    showToast(`Setup "${saveName.trim()}" saved to Library`);
    setSaveName("");
    setShowSaveModal(false);
  };

  const handleRemoveFromSetup = async (item: AgentInfo) => {
    if (item.enabled) await toggleItem(item);
    removeFromSetup(item.id);
  };

  const handleRemoveGroupFromSetup = async (items: AgentInfo[]) => {
    const enabled = items.filter((i) => i.enabled);
    if (enabled.length > 0) await toggleGroup(enabled, false);
    items.forEach((i) => removeFromSetup(i.id));
  };

  const handleClear = async () => {
    await clearSetup();
    setShowClearModal(false);
    showToast("Setup cleared");
  };

  const btnClass =
    "flex h-[34px] items-center gap-2 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20";
  const btnDangerClass =
    "flex h-[34px] items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20";

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
          {setupItems.length > 0 && (
            <button onClick={() => setShowClearModal(true)} className={btnDangerClass}>
              <XCircle className="h-3.5 w-3.5" />
              Clear Setup
            </button>
          )}
          <button onClick={() => setShowSaveModal(true)} className={btnClass}>
            <Save className="h-3.5 w-3.5" />
            Save Setup
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
          active={activeFilter === "agents"}
          onClick={() => setActiveFilter(activeFilter === "agents" ? null : "agents")}
        />
        <SummaryCard
          title="ACTIVE SKILLS"
          enabled={stats.skills.enabled}
          total={stats.skills.total}
          color="#66bb6a"
          active={activeFilter === "skills"}
          onClick={() => setActiveFilter(activeFilter === "skills" ? null : "skills")}
        />
        <SummaryCard
          title="ACTIVE COMMANDS"
          enabled={stats.commands.enabled}
          total={stats.commands.total}
          color="#ffa726"
          active={activeFilter === "commands"}
          onClick={() => setActiveFilter(activeFilter === "commands" ? null : "commands")}
        />
      </div>

      {/* Setup items list grouped by type */}
      {setupItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <span className="text-sm text-[#56565f]">No items in setup</span>
          <span className="text-xs text-[#44444d]">
            Go to Agents, Skills, or Commands and click "Add to Setup"
          </span>
        </div>
      ) : (
          <div className="flex flex-col gap-5">
            {([
              { label: "Active Agents", key: "agents", subGroups: agentSubGroups, color: "#4fc3f7" },
              { label: "Active Skills", key: "skills", subGroups: skillSubGroups, color: "#66bb6a" },
              { label: "Active Commands", key: "commands", subGroups: commandSubGroups, color: "#ffa726" },
            ] as const).filter((g) => g.subGroups.length > 0 && (!activeFilter || g.key === activeFilter)).map((section) => (
              <div key={section.key} className="flex flex-col gap-3">
                <button
                  onClick={() => setCollapsed((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                  className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#56565f] transition-colors hover:text-[#8a8a96]"
                >
                  {collapsed[section.key] ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {section.label}
                </button>
                {!collapsed[section.key] && section.subGroups.map(([groupName, groupItems]) => {
                  const allEnabled = groupItems.every((i) => i.enabled);
                  return (
                  <div key={groupName} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="ml-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: section.color }}>
                        {groupName}
                      </span>
                      <span className="text-[11px] text-[#56565f]">({groupItems.length})</span>
                      {groupItems.length > 1 && (
                        <>
                          <Toggle
                            enabled={allEnabled}
                            onToggle={() => toggleGroup(groupItems, !allEnabled)}
                          />
                          <button
                            onClick={() => handleRemoveGroupFromSetup(groupItems)}
                            title="Remove all from setup"
                            aria-label="Remove all from setup"
                            className="flex h-5 w-5 items-center justify-center rounded-md text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                    <AnimatePresence>
                      {groupItems.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
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
                            onToggle={() => handleToggleWithWarning(item)}
                          />
                          <button
                            onClick={() => handleRemoveFromSetup(item)}
                            title="Remove from setup"
                            aria-label="Remove from setup"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
      )}

      {/* Group warning modal */}
      {pendingToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-[360px] flex-col gap-4 rounded-lg border border-[#3a3a42] bg-[#27272c] p-5 shadow-xl">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-[#ffa726]" />
              <h3 className="text-sm font-semibold text-[#e8e8ec]">
                Group Warning
              </h3>
            </div>
            <p className="text-[13px] leading-relaxed text-[#8a8a96]">
              Disabling items from the{" "}
              <span className="font-semibold text-[#e8e8ec]">
                {pendingToggle.group}
              </span>{" "}
              group may affect other items in this group.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingToggle(null)}
                className="rounded px-3 py-1.5 text-xs text-[#8a8a96] hover:text-[#e8e8ec]"
              >
                Cancel
              </button>
              <button
                onClick={confirmGroupWarning}
                className="rounded bg-[#ffa726] px-3 py-1.5 text-xs font-medium text-[#1e1e23] hover:bg-[#ffa726]/80"
              >
                Disable Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirmation modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-80 flex-col gap-4 rounded-lg border border-[#3a3a42] bg-[#27272c] p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e8e8ec]">
              Clear Setup
            </h3>
            <p className="text-[13px] leading-relaxed text-[#8a8a96]">
              Are you sure you want to clear the current setup? All items will
              be disabled and removed from the list.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="rounded px-3 py-1.5 text-xs text-[#8a8a96] hover:text-[#e8e8ec]"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500/80"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
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
            {saveNameError && (
              <p className="text-[11px] text-red-400">{saveNameError}</p>
            )}
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
                disabled={!saveName.trim() || !!saveNameError}
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

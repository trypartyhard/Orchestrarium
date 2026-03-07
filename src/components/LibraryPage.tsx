import { useState } from "react";
import { Play, Trash2, Download, Upload, Clock, Bot, Sparkles, Terminal } from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../lib/store";

export function LibraryPage() {
  const setups = useAppStore((s) => s.setups);
  const activeSetup = useAppStore((s) => s.activeSetup);
  const applySetup = useAppStore((s) => s.applySetup);
  const deleteSetup = useAppStore((s) => s.deleteSetup);
  const exportSetup = useAppStore((s) => s.exportSetup);
  const importSetup = useAppStore((s) => s.importSetup);
  const showToast = useAppStore((s) => s.showToast);
  const loadSetups = useAppStore((s) => s.loadSetups);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const handleApply = async (name: string) => {
    setApplying(name);
    await applySetup(name);
    showToast(`Setup "${name}" activated`);
    setApplying(null);
  };

  const handleDelete = async (name: string) => {
    await deleteSetup(name);
    setConfirmDelete(null);
    showToast(`Setup "${name}" deleted`);
  };

  const handleExport = async (name: string) => {
    const json = await exportSetup(name);
    if (!json) return;
    const filePath = await save({
      defaultPath: `${name}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (filePath) {
      try {
        await writeTextFile(filePath, json);
        showToast(`Setup "${name}" exported`);
      } catch {
        showToast("Failed to export file");
      }
    }
  };

  const handleImport = async () => {
    const filePath = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return;
    try {
      const content = await readTextFile(filePath);
      await importSetup(content);
      await loadSetups();
      showToast("Setup imported");
    } catch {
      showToast("Failed to import setup");
    }
  };

  function countBySection(entries: { id: string; enabled: boolean }[]) {
    let agents = 0, skills = 0, commands = 0;
    for (const e of entries) {
      if (!e.enabled) continue;
      if (e.id.startsWith("agents/")) agents++;
      else if (e.id.startsWith("skills/")) skills++;
      else if (e.id.startsWith("commands/")) commands++;
    }
    return { agents, skills, commands };
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  }

  const btnClass =
    "flex h-[34px] items-center gap-2 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20";

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e8e8ec]">Library</h1>
          <p className="text-[13px] text-[#7a7a88]">
            Saved setups — switch between configurations instantly
          </p>
        </div>
        <button onClick={handleImport} className={btnClass}>
          <Upload className="h-3.5 w-3.5" />
          Import Setup
        </button>
      </div>

      {/* Setups list */}
      {setups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <span className="text-sm text-[#56565f]">No saved setups</span>
          <span className="text-xs text-[#44444d]">
            Go to Setup and click "Save Setup" to create one
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {setups.map((setup) => {
            const isActive = activeSetup === setup.name;
            const counts = countBySection(setup.entries);
            const enabledCount = setup.entries.filter((e) => e.enabled).length;

            return (
              <div
                key={setup.name}
                className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors ${
                  isActive
                    ? "border-[#4fc3f7]/40 bg-[#4fc3f7]/5"
                    : "border-[#3a3a42] bg-[#27272c] hover:bg-[#313138]"
                }`}
              >
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#e8e8ec]">
                      {setup.name}
                    </span>
                    {isActive && (
                      <span className="rounded-full bg-[#4fc3f7]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4fc3f7]">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#56565f]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(setup.created_at)}
                    </span>
                    <span className="text-[#3a3a42]">|</span>
                    <span className="text-[#66bb6a]">{enabledCount} enabled</span>
                    <span className="text-[#3a3a42]">|</span>
                    <span className="flex items-center gap-1">
                      <Bot className="h-3 w-3 text-[#4fc3f7]" />
                      {counts.agents}
                    </span>
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-[#66bb6a]" />
                      {counts.skills}
                    </span>
                    <span className="flex items-center gap-1">
                      <Terminal className="h-3 w-3 text-[#ffa726]" />
                      {counts.commands}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  {!isActive && (
                    <button
                      onClick={() => handleApply(setup.name)}
                      disabled={applying !== null}
                      title="Activate this setup"
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-[#4fc3f7]/15 px-3 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/25 disabled:opacity-40"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {applying === setup.name ? "Applying..." : "Activate"}
                    </button>
                  )}
                  <button
                    onClick={() => handleExport(setup.name)}
                    title="Export as JSON"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#3a3a42] hover:text-[#8a8a96]"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {confirmDelete === setup.name ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(setup.name)}
                        className="h-8 rounded-lg bg-red-500/15 px-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="h-8 rounded-lg px-2 text-xs text-[#56565f] hover:text-[#8a8a96]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(setup.name)}
                      title="Delete setup"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

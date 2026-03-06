import { useState } from "react";
import { Save, Download, Upload, Trash2 } from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useAppStore } from "../lib/store";

export function SetupsBar() {
  const setups = useAppStore((s) => s.setups);
  const activeSetup = useAppStore((s) => s.activeSetup);
  const applySetup = useAppStore((s) => s.applySetup);
  const createSetup = useAppStore((s) => s.createSetup);
  const deleteSetup = useAppStore((s) => s.deleteSetup);
  const exportSetup = useAppStore((s) => s.exportSetup);
  const importSetup = useAppStore((s) => s.importSetup);
  const showToast = useAppStore((s) => s.showToast);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");

  const handleApply = async (name: string) => {
    await applySetup(name);
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    await createSetup(saveName.trim());
    setSaveName("");
    setShowSaveModal(false);
  };

  const handleExport = async () => {
    if (!activeSetup) {
      showToast("No setup selected to export");
      return;
    }
    const json = await exportSetup(activeSetup);
    if (!json) return;

    const path = await save({
      defaultPath: `${activeSetup}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (path) {
      await writeTextFile(path, json);
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

  const handleDelete = async () => {
    if (!activeSetup) return;
    if (!confirm(`Delete setup "${activeSetup}"?`)) return;
    await deleteSetup(activeSetup);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          value={activeSetup ?? ""}
          onChange={(e) => e.target.value && handleApply(e.target.value)}
          className="h-8 rounded border border-[#2a2a44] bg-[#1a1a2e] px-2 text-xs text-[#d0d0e8] outline-none focus:border-[#4fc3f7]"
        >
          <option value="">Select setup...</option>
          {setups.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowSaveModal(true)}
          title="Save current state as setup"
          className="flex h-8 items-center gap-1.5 rounded border border-[#2a2a44] bg-[#1a1a2e] px-2.5 text-xs text-[#8888aa] transition-colors hover:border-[#4fc3f7] hover:text-[#d0d0e8]"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>

        <button
          onClick={handleExport}
          title="Export setup to JSON file"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2a44] bg-[#1a1a2e] text-[#8888aa] transition-colors hover:border-[#4fc3f7] hover:text-[#d0d0e8]"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={handleImport}
          title="Import setup from JSON file"
          className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2a44] bg-[#1a1a2e] text-[#8888aa] transition-colors hover:border-[#4fc3f7] hover:text-[#d0d0e8]"
        >
          <Upload className="h-3.5 w-3.5" />
        </button>

        {activeSetup && (
          <button
            onClick={handleDelete}
            title="Delete selected setup"
            className="flex h-8 w-8 items-center justify-center rounded border border-[#2a2a44] bg-[#1a1a2e] text-[#555577] transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-80 flex-col gap-4 rounded-lg border border-[#2a2a44] bg-[#1a1a2e] p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#d0d0e8]">
              Save Setup
            </h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Setup name..."
              autoFocus
              className="h-9 rounded border border-[#2a2a44] bg-[#12121c] px-3 text-sm text-[#d0d0e8] outline-none focus:border-[#4fc3f7]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName("");
                }}
                className="rounded px-3 py-1.5 text-xs text-[#8888aa] hover:text-[#d0d0e8]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="rounded bg-[#4fc3f7] px-3 py-1.5 text-xs font-medium text-[#12121c] hover:bg-[#4fc3f7]/80 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

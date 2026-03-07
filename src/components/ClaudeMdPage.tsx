import { useState, useEffect } from "react";
import { Play, Pause, Trash2, Plus, Pencil, Save, X, FileText, Copy } from "lucide-react";
import { useAppStore } from "../lib/store";

export function ClaudeMdPage() {
  const profiles = useAppStore((s) => s.claudeProfiles);
  const loadProfiles = useAppStore((s) => s.loadClaudeProfiles);
  const createProfile = useAppStore((s) => s.createClaudeProfile);
  const activateProfile = useAppStore((s) => s.activateClaudeProfile);
  const deactivateProfile = useAppStore((s) => s.deactivateClaudeProfile);
  const deleteProfile = useAppStore((s) => s.deleteClaudeProfile);
  const readProfile = useAppStore((s) => s.readClaudeProfile);
  const saveProfile = useAppStore((s) => s.saveClaudeProfile);
  const showToast = useAppStore((s) => s.showToast);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createFromCurrent, setCreateFromCurrent] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    await createProfile(createName.trim(), createFromCurrent);
    showToast(`Profile "${createName.trim()}" created`);
    setCreateName("");
    setCreateFromCurrent(true);
    setShowCreateModal(false);
  };

  const handleActivate = async (name: string) => {
    await activateProfile(name);
    showToast(`Profile "${name}" activated`);
  };

  const handleDeactivate = async () => {
    await deactivateProfile();
    showToast("Profile deactivated");
  };

  const handleDelete = async (name: string) => {
    if (editingProfile === name) {
      setEditingProfile(null);
    }
    await deleteProfile(name);
    setConfirmDelete(null);
    showToast(`Profile "${name}" deleted`);
  };

  const handleEdit = async (name: string) => {
    const content = await readProfile(name);
    setEditorContent(content);
    setEditingProfile(name);
    setEditorDirty(false);
  };

  const handleSave = async () => {
    if (!editingProfile) return;
    await saveProfile(editingProfile, editorContent);
    setEditorDirty(false);
    showToast(`Profile "${editingProfile}" saved`);
  };

  const handleCloseEditor = () => {
    if (editorDirty) {
      if (!window.confirm("You have unsaved changes. Discard?")) return;
    }
    setEditingProfile(null);
    setEditorContent("");
    setEditorDirty(false);
  };

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  const btnClass =
    "flex h-[34px] items-center gap-2 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-4 text-xs font-medium text-[#a78bfa] transition-colors hover:bg-[#a78bfa]/20";

  // Editor view
  if (editingProfile) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseEditor}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#3a3a42] hover:text-[#8a8a96]"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[18px] font-semibold text-[#e8e8ec]">
                {editingProfile}
              </h1>
              <p className="text-[12px] text-[#56565f]">
                Editing CLAUDE.md profile
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!editorDirty}
            className="flex h-[34px] items-center gap-2 rounded-lg bg-[#a78bfa] px-4 text-xs font-medium text-[#1e1e23] transition-colors hover:bg-[#a78bfa]/80 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
        <textarea
          value={editorContent}
          onChange={(e) => {
            setEditorContent(e.target.value);
            setEditorDirty(true);
          }}
          spellCheck={false}
          className="flex-1 resize-none rounded-xl border border-[#3a3a42] bg-[#1e1e23] p-4 font-mono text-[13px] leading-relaxed text-[#c0c0c8] outline-none focus:border-[#a78bfa]/50"
        />
      </div>
    );
  }

  // Profile list view
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#e8e8ec]">CLAUDE.md</h1>
          <p className="text-[13px] text-[#7a7a88]">
            Manage CLAUDE.md profiles — switch instructions instantly
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className={btnClass}>
          <Plus className="h-3.5 w-3.5" />
          New Profile
        </button>
      </div>

      {/* Profiles list */}
      {profiles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <span className="text-sm text-[#56565f]">No saved profiles</span>
          <span className="text-xs text-[#44444d]">
            Click "New Profile" to save your current CLAUDE.md as a profile
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((profile) => (
            <div
              key={profile.name}
              className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition-colors ${
                profile.active
                  ? "border-[#a78bfa]/40 bg-[#a78bfa]/5"
                  : "border-[#3a3a42] bg-[#27272c] hover:bg-[#313138]"
              }`}
            >
              {/* Icon */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: profile.active ? "#a78bfa18" : "#3a3a4280" }}
              >
                <FileText className="h-4 w-4" style={{ color: profile.active ? "#a78bfa" : "#56565f" }} />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#e8e8ec]">
                    {profile.name}
                  </span>
                  {profile.active && (
                    <span className="rounded-full bg-[#a78bfa]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#a78bfa]">
                      Active
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[#56565f]">
                  {formatSize(profile.size_bytes)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                {profile.active ? (
                  <button
                    onClick={handleDeactivate}
                    title="Deactivate this profile"
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-[#56565f]/15 px-3 text-xs font-medium text-[#8a8a96] transition-colors hover:bg-[#56565f]/25"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Deactivate
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(profile.name)}
                    title="Activate this profile"
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-[#a78bfa]/15 px-3 text-xs font-medium text-[#a78bfa] transition-colors hover:bg-[#a78bfa]/25"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Activate
                  </button>
                )}
                <button
                  onClick={() => handleEdit(profile.name)}
                  title="Edit profile"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#3a3a42] hover:text-[#8a8a96]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {confirmDelete === profile.name ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(profile.name)}
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
                    onClick={() => setConfirmDelete(profile.name)}
                    title="Delete profile"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-[340px] flex-col gap-4 rounded-lg border border-[#3a3a42] bg-[#27272c] p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e8e8ec]">
              New Profile
            </h3>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Profile name..."
              autoFocus
              className="h-9 rounded border border-[#3a3a42] bg-[#1e1e23] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#a78bfa]"
            />
            <label className="flex items-center gap-2.5 cursor-pointer">
              <button
                onClick={() => setCreateFromCurrent(!createFromCurrent)}
                className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                  createFromCurrent
                    ? "border-[#a78bfa] bg-[#a78bfa]"
                    : "border-[#3a3a42] bg-[#1e1e23]"
                }`}
              >
                {createFromCurrent && (
                  <Copy className="h-3 w-3 text-white" />
                )}
              </button>
              <span className="text-[13px] text-[#8a8a96]">
                Copy from current CLAUDE.md
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateName("");
                }}
                className="rounded px-3 py-1.5 text-xs text-[#8a8a96] hover:text-[#e8e8ec]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim()}
                className="rounded bg-[#a78bfa] px-3 py-1.5 text-xs font-medium text-[#1e1e23] hover:bg-[#a78bfa]/80 disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

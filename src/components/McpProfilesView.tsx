import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileJson2,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  SearchCheck,
  Trash2,
  X,
} from "lucide-react";
import type {
  McpProfileActivationPreview,
  McpProfileHealth,
  McpProfileSummary,
} from "../bindings";
import { useAppStore } from "../lib/store";
import { useEscapeKey } from "../lib/useEscapeKey";
import { validateName } from "../lib/validateName";

type McpProfilesViewProps = {
  onOpenLiveServers: () => void;
};

type ParsedProfilePreview = {
  parseError: string | null;
  serverNames: string[];
  serverTypes: McpProfileSummary["serverTypes"];
  formattedJson: string;
};

function healthLabel(health: McpProfileHealth) {
  switch (health) {
    case "broken":
      return "Broken";
    case "conflict":
      return "Conflict";
    case "drift":
      return "Drift";
    default:
      return "OK";
  }
}

function healthClassName(health: McpProfileHealth) {
  switch (health) {
    case "broken":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "conflict":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "drift":
      return "border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f5c36b]";
    default:
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
}

function typeLabel(type: McpProfileSummary["serverTypes"][number]) {
  switch (type) {
    case "http":
      return "HTTP";
    case "sse":
      return "SSE";
    default:
      return "Command";
  }
}

function inferServerType(rawServer: unknown): McpProfileSummary["serverTypes"][number] {
  if (!rawServer || typeof rawServer !== "object" || Array.isArray(rawServer)) {
    return "command";
  }

  const server = rawServer as Record<string, unknown>;
  const explicitType = server.type;
  if (explicitType === "http" || explicitType === "sse" || explicitType === "command") {
    return explicitType;
  }
  if (typeof server.url === "string") {
    return "http";
  }
  return "command";
}

function parseProfilePreview(content: string): ParsedProfilePreview {
  if (!content.trim()) {
    return {
      parseError: null,
      serverNames: [],
      serverTypes: [],
      formattedJson: content,
    };
  }

  try {
    const parsed = JSON.parse(content) as { servers?: Record<string, unknown> };
    const rawServers = parsed?.servers && typeof parsed.servers === "object"
      ? parsed.servers
      : {};
    const serverNames = Object.keys(rawServers);
    const serverTypes = [...new Set(serverNames.map((name) => inferServerType(rawServers[name])))];

    return {
      parseError: null,
      serverNames,
      serverTypes,
      formattedJson: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return {
      parseError: "Preview JSON could not be parsed on the client. Raw content is shown below.",
      serverNames: [],
      serverTypes: [],
      formattedJson: content,
    };
  }
}

function ValidationPanel({ preview }: { preview: McpProfileActivationPreview }) {
  if (preview.canActivate && preview.issues.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Ready to activate
        </div>
        <p className="mt-2 text-[12px] text-[#cde8d7]">
          Preflight passed. This profile can be applied without overwriting manual live servers.
        </p>
      </div>
    );
  }

  if (preview.canActivate) {
    return (
      <div className="mt-4 rounded-xl border border-[#4fc3f7]/25 bg-[#4fc3f7]/10 p-4">
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#7ad7ff]">
          <CheckCircle2 className="h-4 w-4" />
          Activation allowed with warnings
        </div>
        <div className="mt-2 grid gap-2 text-[12px] text-[#b8dcea]">
          {preview.issues.map((issue, index) => (
            <p key={`preview-warning-${preview.profileName}-${index}`}>{issue.message}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2 text-[12px] font-medium text-amber-300">
        <AlertCircle className="h-4 w-4" />
        Activation blocked
      </div>
      <div className="mt-2 grid gap-2 text-[12px] text-[#d9d2bf]">
        {preview.issues.map((issue, index) => (
          <p key={`preview-issue-${preview.profileName}-${index}`}>{issue.message}</p>
        ))}
      </div>
    </div>
  );
}

export function McpProfilesView({ onOpenLiveServers }: McpProfilesViewProps) {
  const mcpProfiles = useAppStore((s) => s.mcpProfiles);
  const activeContext = useAppStore((s) => s.activeContext);
  const projectDir = useAppStore((s) => s.projectDir);
  const createMcpProfile = useAppStore((s) => s.createMcpProfile);
  const activateMcpProfile = useAppStore((s) => s.activateMcpProfile);
  const deactivateMcpProfile = useAppStore((s) => s.deactivateMcpProfile);
  const deleteMcpProfile = useAppStore((s) => s.deleteMcpProfile);
  const readMcpProfile = useAppStore((s) => s.readMcpProfile);
  const saveMcpProfile = useAppStore((s) => s.saveMcpProfile);
  const previewActivateMcpProfile = useAppStore((s) => s.previewActivateMcpProfile);
  const showToast = useAppStore((s) => s.showToast);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [savingEditor, setSavingEditor] = useState(false);
  const [validationPreview, setValidationPreview] = useState<McpProfileActivationPreview | null>(null);
  const [previewProfile, setPreviewProfile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewValidation, setPreviewValidation] = useState<McpProfileActivationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const editRequestRef = useRef(0);
  const previewRequestRef = useRef(0);

  const createNameError = validateName(createName);
  const canManageProfiles = activeContext === "global" || (activeContext === "project" && !!projectDir);
  const isGlobalContext = activeContext === "global";
  const scopeLabel = isGlobalContext ? "global" : "project-scoped";
  const liveConfigLabel = isGlobalContext ? "~/.claude.json" : ".mcp.json";
  const contextTargetLabel = isGlobalContext ? "global Claude config" : "selected project";
  const projectName = useMemo(() => {
    if (!projectDir) {
      return null;
    }
    return projectDir.replace(/\\/g, "/").split("/").pop() || projectDir;
  }, [projectDir]);
  const previewDetails = useMemo(
    () => parseProfilePreview(previewContent),
    [previewContent],
  );

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setCreateName("");
  }, []);

  const closeEditor = useCallback(() => {
    editRequestRef.current += 1;
    setEditingProfile(null);
    setEditorContent("");
    setLoadingEditor(false);
    setSavingEditor(false);
  }, []);

  const closePreview = useCallback(() => {
    previewRequestRef.current += 1;
    setPreviewProfile(null);
    setPreviewContent("");
    setPreviewValidation(null);
    setLoadingPreview(false);
  }, []);

  useEscapeKey(useCallback(() => {
    if (confirmDelete) {
      setConfirmDelete(null);
      return;
    }
    if (previewProfile) {
      closePreview();
      return;
    }
    if (editingProfile && !savingEditor) {
      closeEditor();
      return;
    }
    if (showCreateModal) {
      closeCreateModal();
    }
  }, [
    closeCreateModal,
    closeEditor,
    closePreview,
    confirmDelete,
    editingProfile,
    previewProfile,
    savingEditor,
    showCreateModal,
  ]));

  const runValidation = useCallback(async (name: string, showSuccessToast = false) => {
    const preview = await previewActivateMcpProfile(name);
    if (!preview) {
      return null;
    }

    setValidationPreview(preview);

    if (showSuccessToast) {
      if (!preview.canActivate) {
        showToast(`MCP profile "${name}" has conflicts or broken state`, "error");
      } else if (preview.issues.length > 0) {
        showToast(`MCP profile "${name}" validated with warnings`);
      } else {
        showToast(`MCP profile "${name}" is ready to activate`);
      }
    }

    return preview;
  }, [previewActivateMcpProfile, showToast]);

  const handleEdit = async (name: string) => {
    const requestId = editRequestRef.current + 1;
    editRequestRef.current = requestId;

    setEditingProfile(name);
    setEditorContent("");
    setLoadingEditor(true);
    setSavingEditor(false);

    const content = await readMcpProfile(name);
    if (editRequestRef.current !== requestId) {
      return;
    }

    setEditorContent(content);
    setLoadingEditor(false);
  };

  const handlePreview = async (name: string) => {
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    setPreviewProfile(name);
    setPreviewContent("");
    setPreviewValidation(null);
    setLoadingPreview(true);

    const [content, validation] = await Promise.all([
      readMcpProfile(name),
      previewActivateMcpProfile(name),
    ]);
    if (previewRequestRef.current !== requestId) {
      return;
    }

    if (validation) {
      setValidationPreview(validation);
      setPreviewValidation(validation);
    }
    setPreviewContent(content);
    setLoadingPreview(false);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name || createNameError) {
      return;
    }

    const ok = await createMcpProfile(name);
    if (!ok) {
      return;
    }

    showToast(`MCP profile "${name}" created`);
    closeCreateModal();
    void handleEdit(name);
  };

  const handleSave = async () => {
    if (!editingProfile) {
      return;
    }

    setSavingEditor(true);
    const ok = await saveMcpProfile(editingProfile, editorContent);
    setSavingEditor(false);
    if (!ok) {
      return;
    }

    showToast(`MCP profile "${editingProfile}" saved`);
    closeEditor();
  };

  const handleActivate = async (name: string) => {
    const preview = await runValidation(name);
    if (!preview) {
      return;
    }

    if (!preview.canActivate) {
      showToast(`MCP profile "${name}" has conflicts or broken state`, "error");
      return;
    }

    const ok = await activateMcpProfile(name);
    if (!ok) {
      return;
    }

    if (previewProfile === name) {
      setPreviewValidation(preview);
    }
    showToast(`MCP profile "${name}" activated`);
  };

  const handleDeactivate = async () => {
    const ok = await deactivateMcpProfile();
    if (!ok) {
      return;
    }

    setValidationPreview(null);
    if (previewProfile) {
      setPreviewValidation(null);
    }
    showToast("MCP profile deactivated");
  };

  const handleDelete = async (name: string) => {
    const ok = await deleteMcpProfile(name);
    if (!ok) {
      return;
    }

    if (editingProfile === name) {
      closeEditor();
    }
    if (previewProfile === name) {
      closePreview();
    }
    if (validationPreview?.profileName === name) {
      setValidationPreview(null);
    }
    setConfirmDelete(null);
    showToast(`MCP profile "${name}" deleted`);
  };

  if (!canManageProfiles) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4fc3f7]/10 text-[#4fc3f7]">
          <FileJson2 className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-[#e8e8ec]">Project MCP Profiles need a selected project</h2>
          <p className="max-w-lg text-sm text-[#7a7a88]">
            Switch to a project to manage project-scoped profile activation. Global MCP profiles stay available in global context and the Live Servers tab.
          </p>
          {projectName && (
            <p className="text-xs text-[#5e5e6c]">Select project context for {projectName}.</p>
          )}
        </div>
        <button
          onClick={onOpenLiveServers}
          className="rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 py-2 text-sm font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
        >
          Open Live Servers
        </button>
      </div>
    );
  }

  if (editingProfile) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={closeEditor}
              aria-label="Close profile editor"
              disabled={savingEditor}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#3a3a42] hover:text-[#8a8a96] disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold text-[#e8e8ec]">{editingProfile}</h2>
              <p className="text-[12px] text-[#6b6b78]">
                Edit the full JSON definition for this MCP profile.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              void handleSave();
            }}
            disabled={savingEditor}
            className="rounded-lg bg-[#4fc3f7] px-3 py-1.5 text-xs font-medium text-[#1e1e23] transition-colors hover:bg-[#4fc3f7]/80 disabled:opacity-40"
          >
            {savingEditor ? "Saving..." : "Save"}
          </button>
        </div>

        {loadingEditor ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#555577]" />
          </div>
        ) : (
          <textarea
            value={editorContent}
            onChange={(event) => setEditorContent(event.target.value)}
            spellCheck={false}
            className="flex-1 resize-none rounded-xl border border-[#3a3a42] bg-[#1e1e23] p-4 font-mono text-[13px] leading-relaxed text-[#c0c0c8] outline-none focus:border-[#4fc3f7]/50"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[#e8e8ec]">Profiles</h2>
          <p className="text-[13px] text-[#7a7a88]">
            Activate a {scopeLabel} MCP bundle into <code className="rounded bg-[#23232a] px-1 py-0.5 text-[12px]">{liveConfigLabel}</code>.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex h-[34px] items-center gap-2 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
        >
          <Plus className="h-3.5 w-3.5" />
          New Profile
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-[#2d2d35] bg-[#202027] px-4 py-3 text-[12px] text-[#8a8a96]">
        Profiles own only the servers they inject into the current live config. Manual live servers stay untouched during activate/deactivate, and Validate shows conflicts before you apply anything.
      </div>

      {mcpProfiles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-[#6b6b78]">
          <FileJson2 className="h-12 w-12 opacity-50" />
          <p className="text-sm">No MCP profiles yet</p>
          <p className="max-w-md text-xs">
            Create a profile, fill in its JSON, validate it, then activate it into the {contextTargetLabel}.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {mcpProfiles.map((profile) => {
            const preview = validationPreview?.profileName === profile.name ? validationPreview : null;

            return (
              <article
                key={profile.name}
                className="rounded-2xl border border-[#2d2d35] bg-[#23232a] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4fc3f7]/10 text-[#4fc3f7]">
                      <FileJson2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-[#e8e8ec]">{profile.name}</h3>
                        {profile.active && (
                          <span className="rounded-full border border-[#4fc3f7]/25 bg-[#4fc3f7]/10 px-2 py-0.5 text-[10px] font-medium text-[#4fc3f7]">
                            Active
                          </span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${healthClassName(profile.healthStatus)}`}>
                          {healthLabel(profile.healthStatus)}
                        </span>
                        <span className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-[#9c9cab]">
                          {profile.serverCount} server{profile.serverCount === 1 ? "" : "s"}
                        </span>
                        {profile.serverTypes.map((type) => (
                          <span
                            key={`${profile.name}-${type}`}
                            className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-[#9c9cab]"
                          >
                            {typeLabel(type)}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-[12px] text-[#7a7a88]">
                        {profile.active
                          ? "Active profile owns a subset of the current live config."
                          : `Inactive profile can be validated, previewed and then applied into the current ${isGlobalContext ? "global" : "project"} live config.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <button
                      onClick={() => {
                        void runValidation(profile.name, true);
                      }}
                      title="Validate profile"
                      aria-label="Validate profile"
                      className="flex h-8 items-center gap-1.5 rounded-lg border border-[#4fc3f7]/20 bg-[#4fc3f7]/8 px-3 text-xs font-medium text-[#7ad7ff] transition-colors hover:bg-[#4fc3f7]/15"
                    >
                      <SearchCheck className="h-3.5 w-3.5" />
                      Validate
                    </button>
                    {profile.active ? (
                      <button
                        onClick={() => {
                          void handleDeactivate();
                        }}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#56565f]/15 px-3 text-xs font-medium text-[#8a8a96] transition-colors hover:bg-[#56565f]/25"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          void handleActivate(profile.name);
                        }}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#4fc3f7]/15 px-3 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/25"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => {
                        void handlePreview(profile.name);
                      }}
                      title="Preview profile"
                      aria-label="Preview profile"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#4fc3f7]/10 hover:text-[#7ad7ff]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        void handleEdit(profile.name);
                      }}
                      title="Edit profile JSON"
                      aria-label="Edit profile JSON"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#3a3a42] hover:text-[#8a8a96]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDelete === profile.name ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            void handleDelete(profile.name);
                          }}
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
                        disabled={profile.active}
                        title={profile.active ? "Deactivate the profile before deleting it" : "Delete profile"}
                        aria-label="Delete profile"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {preview && <ValidationPanel preview={preview} />}
              </article>
            );
          })}
        </div>
      )}

      {previewProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closePreview}
        >
          <div
            className="relative flex max-h-[86vh] w-[720px] flex-col rounded-xl border border-[#3a3a42] bg-[#1e1e23] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#3a3a42] px-6 py-4">
              <div>
                <h3 className="truncate text-[15px] font-semibold text-[#e8e8ec]">{previewProfile}</h3>
                <p className="text-[12px] text-[#6b6b78]">
                  Read-only preview of the profile JSON and its activation preflight.
                </p>
              </div>
              <button
                onClick={closePreview}
                aria-label="Close profile preview"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {loadingPreview ? (
                <div className="flex h-56 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#555577]" />
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-[#9c9cab]">
                      {previewDetails.serverNames.length} server{previewDetails.serverNames.length === 1 ? "" : "s"}
                    </span>
                    {previewDetails.serverTypes.map((type) => (
                      <span
                        key={`preview-type-${previewProfile}-${type}`}
                        className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-[#9c9cab]"
                      >
                        {typeLabel(type)}
                      </span>
                    ))}
                  </div>

                  {previewDetails.serverNames.length > 0 && (
                    <div>
                      <p className="mb-2 text-[12px] font-medium text-[#9c9cab]">Servers in this profile</p>
                      <div className="flex flex-wrap gap-2">
                        {previewDetails.serverNames.map((serverName) => (
                          <span
                            key={`preview-server-${previewProfile}-${serverName}`}
                            className="rounded-full border border-[#4fc3f7]/20 bg-[#4fc3f7]/8 px-2.5 py-1 text-[11px] text-[#b8dcea]"
                          >
                            {serverName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {previewValidation && <ValidationPanel preview={previewValidation} />}

                  {previewDetails.parseError && (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-[12px] text-[#d9d2bf]">
                      {previewDetails.parseError}
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-[12px] font-medium text-[#9c9cab]">JSON</p>
                    <pre className="overflow-x-auto rounded-xl border border-[#2d2d35] bg-[#17171d] p-4 text-[12px] leading-relaxed text-[#b8b8c2]">
                      {previewDetails.formattedJson}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex w-[360px] flex-col gap-4 rounded-lg border border-[#3a3a42] bg-[#27272c] p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e8e8ec]">New MCP Profile</h3>
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleCreate()}
              placeholder="backend-dev"
              autoFocus
              className="h-9 rounded border border-[#3a3a42] bg-[#1e1e23] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#4fc3f7]"
            />
            {createNameError && <p className="text-[11px] text-red-400">{createNameError}</p>}
            <p className="text-[12px] text-[#6b6b78]">
              This creates an empty JSON-backed profile and opens the editor immediately.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={closeCreateModal}
                className="rounded-lg border border-[#3a3a42] px-3 py-1.5 text-xs text-[#8a8a96] transition-colors hover:bg-[#313138]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void handleCreate();
                }}
                disabled={!createName.trim() || !!createNameError}
                className="rounded-lg bg-[#4fc3f7] px-3 py-1.5 text-xs font-medium text-[#1e1e23] transition-colors hover:bg-[#4fc3f7]/80 disabled:opacity-40"
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

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Globe,
  Loader2,
  Pencil,
  Plug,
  Plus,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import type {
  EditableMcpServer,
  McpServerSummary,
  McpServerType,
} from "../bindings";
import { useAppStore } from "../lib/store";
import { useEscapeKey } from "../lib/useEscapeKey";
import { FilterPills } from "./FilterPills";
import { SearchBar } from "./SearchBar";
import { Toggle } from "./Toggle";

type McpFormState = {
  name: string;
  serverType: McpServerType;
  command: string;
  argsText: string;
  envText: string;
  url: string;
  headersText: string;
};

const EMPTY_FORM: McpFormState = {
  name: "",
  serverType: "command",
  command: "",
  argsText: "",
  envText: "",
  url: "",
  headersText: "",
};

function typeIcon(type: McpServerSummary["serverType"]) {
  return type === "command" ? TerminalSquare : Globe;
}

function typeLabel(type: McpServerSummary["serverType"]) {
  switch (type) {
    case "http":
      return "HTTP";
    case "sse":
      return "SSE";
    default:
      return "Command";
  }
}

function scopeLabel(scope: McpServerSummary["scope"]) {
  return scope === "global" ? "Global" : "Project";
}

function sourceLabel(source: McpServerSummary["source"]) {
  return source === "mcpJson" ? ".mcp.json" : "~/.claude.json";
}

function objectToText(value: Record<string, string>) {
  return Object.keys(value).length === 0 ? "" : JSON.stringify(value, null, 2);
}

function formFromEditableServer(server: EditableMcpServer): McpFormState {
  return {
    name: server.name,
    serverType: server.serverType,
    command: server.command ?? "",
    argsText: server.args.join("\n"),
    envText: objectToText(server.env),
    url: server.url ?? "",
    headersText: objectToText(server.headers),
  };
}

function parseJsonObject(text: string, label: string) {
  if (!text.trim()) {
    return { value: {} as Record<string, string>, error: null };
  }

  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: {} as Record<string, string>, error: `${label} must be a JSON object` };
    }

    const entries = Object.entries(parsed);
    for (const [key, value] of entries) {
      if (typeof value !== "string") {
        return { value: {} as Record<string, string>, error: `${label}.${key} must be a string` };
      }
    }

    return {
      value: Object.fromEntries(entries) as Record<string, string>,
      error: null,
    };
  } catch {
    return { value: {} as Record<string, string>, error: `${label} must be valid JSON` };
  }
}

function noteForServer(server: McpServerSummary) {
  if (!server.canToggle) {
    return "Toggle is unavailable for this source in V1.";
  }
  if (!server.canEdit) {
    return "Toggle is available, but structured edit is unavailable for this config in V1.";
  }
  return "Local .mcp.json server. Toggle writes project overrides in ~/.claude.json and edit updates the project .mcp.json file.";
}

export function McpPage() {
  const mcpServers = useAppStore((s) => s.mcpServers);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const filter = useAppStore((s) => s.filter);
  const loading = useAppStore((s) => s.loading);
  const activeContext = useAppStore((s) => s.activeContext);
  const projectDir = useAppStore((s) => s.projectDir);
  const toggleMcpServer = useAppStore((s) => s.toggleMcpServer);
  const getMcpServerDetail = useAppStore((s) => s.getMcpServerDetail);
  const createMcpServer = useAppStore((s) => s.createMcpServer);
  const updateMcpServer = useAppStore((s) => s.updateMcpServer);
  const deleteMcpServer = useAppStore((s) => s.deleteMcpServer);
  const showToast = useAppStore((s) => s.showToast);

  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<McpFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const detailRequestRef = useRef(0);

  const closeEditor = useCallback(() => {
    detailRequestRef.current += 1;
    setShowEditor(false);
    setEditorMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setLoadingDetail(false);
    setSubmitting(false);
  }, []);

  useEscapeKey(useCallback(() => {
    if (confirmDelete) {
      setConfirmDelete(null);
      return;
    }
    if (showEditor && !submitting) {
      closeEditor();
    }
  }, [closeEditor, confirmDelete, showEditor, submitting]));

  const counts = useMemo(
    () => ({
      all: mcpServers.length,
      enabled: mcpServers.filter((server) => server.enabled).length,
      disabled: mcpServers.filter((server) => !server.enabled).length,
    }),
    [mcpServers],
  );

  const filtered = useMemo(() => {
    let result = mcpServers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((server) =>
        server.name.toLowerCase().includes(query)
        || server.redactedPreview.toLowerCase().includes(query)
        || server.source.toLowerCase().includes(query)
        || server.scope.toLowerCase().includes(query),
      );
    }

    if (filter === "enabled") {
      result = result.filter((server) => server.enabled);
    } else if (filter === "disabled") {
      result = result.filter((server) => !server.enabled);
    }

    return result;
  }, [filter, mcpServers, searchQuery]);

  const projectName = projectDir
    ? projectDir.replace(/\\/g, "/").split("/").pop() || projectDir
    : null;
  const canManageLocalServers = activeContext === "project" && !!projectDir;

  const openCreateModal = () => {
    detailRequestRef.current += 1;
    setEditorMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setLoadingDetail(false);
    setSubmitting(false);
    setShowEditor(true);
  };

  const openEditModal = async (server: McpServerSummary) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;

    setEditorMode("edit");
    setEditingId(server.id);
    setFormError(null);
    setLoadingDetail(true);
    setSubmitting(false);
    setShowEditor(true);

    const detail = await getMcpServerDetail(server.id);
    if (detailRequestRef.current !== requestId) return;

    setLoadingDetail(false);
    if (!detail) {
      closeEditor();
      return;
    }

    setForm(formFromEditableServer(detail));
  };

  const handleDelete = async (server: McpServerSummary) => {
    const ok = await deleteMcpServer(server);
    if (!ok) return;
    setConfirmDelete(null);
    showToast(`MCP server "${server.name}" deleted`);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      setFormError("Server name is required");
      return;
    }

    const env = parseJsonObject(form.envText, "Env");
    if (env.error) {
      setFormError(env.error);
      return;
    }

    const headers = parseJsonObject(form.headersText, "Headers");
    if (headers.error) {
      setFormError(headers.error);
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const args = form.argsText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    const baseInput = {
      serverType: form.serverType,
      command: form.command.trim() || null,
      args,
      env: env.value,
      url: form.url.trim() || null,
      headers: headers.value,
    };

    const ok = editorMode === "create"
      ? await createMcpServer({ name, ...baseInput })
      : await updateMcpServer({ id: editingId!, ...baseInput });

    setSubmitting(false);
    if (!ok) return;

    showToast(
      editorMode === "create"
        ? `MCP server "${name}" created`
        : `MCP server "${name}" updated`,
    );
    closeEditor();
  };

  const editorTitle = editorMode === "create" ? "New MCP Server" : "Edit MCP Server";
  const primaryButtonLabel = submitting
    ? editorMode === "create"
      ? "Creating..."
      : "Saving..."
    : editorMode === "create"
      ? "Create"
      : "Save";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#555577]" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#3a3a42] px-4">
        <SearchBar />
        <FilterPills counts={counts} />
      </header>

      <div className="border-b border-[#2a2a32] bg-[#202027] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4fc3f7]/12 text-[#4fc3f7]">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-[#e8e8ec]">MCP Servers</h1>
              <p className="text-[12px] text-[#7a7a88]">
                Managed independently from Setups.
              </p>
            </div>
          </div>
          {canManageLocalServers && (
            <button
              onClick={openCreateModal}
              className="flex h-[34px] items-center gap-2 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-4 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
            >
              <Plus className="h-3.5 w-3.5" />
              New Server
            </button>
          )}
        </div>
        <p className="mt-3 text-[12px] text-[#8a8a96]">
          {activeContext === "global"
            ? "Showing top-level MCP servers from ~/.claude.json."
            : `Showing inherited global MCP servers plus project-linked sources for ${projectName ?? "the selected project"}.`}
        </p>
      </div>

      {mcpServers.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-[#6b6b78]">
          <Plug className="h-12 w-12 opacity-50" />
          <p className="text-sm">No MCP servers found</p>
          <p className="max-w-md text-xs">
            {activeContext === "global"
              ? "Add MCP definitions to ~/.claude.json to see them here."
              : "Add project MCP definitions to ~/.claude.json or place a .mcp.json file in the project root."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[#555577]">
          No matches for "{searchQuery}"
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-4">
            {filtered.map((server) => {
              const Icon = typeIcon(server.serverType);
              const localProjectServer = server.source === "mcpJson" && server.scope === "project";

              return (
                <article
                  key={server.id}
                  className="rounded-2xl border border-[#2d2d35] bg-[#23232a] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.15)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4fc3f7]/10 text-[#4fc3f7]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-[#e8e8ec]">
                            {server.name}
                          </h2>
                          <span className="rounded-full border border-[#4fc3f7]/25 bg-[#4fc3f7]/10 px-2 py-0.5 text-[10px] font-medium text-[#4fc3f7]">
                            {typeLabel(server.serverType)}
                          </span>
                          <span className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-[#9c9cab]">
                            {sourceLabel(server.source)}
                          </span>
                          <span className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-2 py-0.5 text-[10px] font-medium text-[#9c9cab]">
                            {scopeLabel(server.scope)}
                          </span>
                        </div>
                        {server.projectPath && (
                          <p className="mt-1 text-[11px] text-[#6b6b78]">
                            {server.projectPath}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div className="flex items-center justify-end gap-1.5">
                        {localProjectServer && server.canEdit && (
                          <button
                            onClick={() => {
                              void openEditModal(server);
                            }}
                            title="Edit MCP server"
                            aria-label="Edit MCP server"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-[#3a3a42] hover:text-[#8a8a96]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {localProjectServer && (
                          confirmDelete === server.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  void handleDelete(server);
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
                              onClick={() => setConfirmDelete(server.id)}
                              title="Delete MCP server"
                              aria-label="Delete MCP server"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#56565f] transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                        {server.canToggle && (
                          <Toggle
                            enabled={server.enabled}
                            onToggle={() => {
                              void toggleMcpServer(server);
                            }}
                          />
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            server.enabled
                              ? "bg-emerald-500/12 text-emerald-300"
                              : "bg-[#3a3a42] text-[#8a8a96]"
                          }`}
                        >
                          {server.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-[#7a7a88]">
                    {noteForServer(server)}
                  </p>

                  <pre className="mt-4 overflow-x-auto rounded-xl border border-[#2d2d35] bg-[#17171d] p-4 text-[12px] leading-relaxed text-[#b8b8c2]">
                    {server.redactedPreview}
                  </pre>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex max-h-[86vh] w-[620px] flex-col rounded-xl border border-[#3a3a42] bg-[#1e1e23] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3a3a42] px-6 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#e8e8ec]">{editorTitle}</h2>
                <p className="text-[12px] text-[#6b6b78]">
                  {editorMode === "create"
                    ? "Create a project-local server in .mcp.json."
                    : "Edit a project-local server in .mcp.json."}
                </p>
              </div>
              <button
                onClick={closeEditor}
                aria-label="Close editor"
                disabled={submitting}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8] disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#555577]" />
              </div>
            ) : (
              <div className="overflow-y-auto px-6 py-5">
                <div className="grid gap-4">
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-medium text-[#9c9cab]">Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                      disabled={editorMode === "edit"}
                      placeholder="filesystem"
                      className="h-10 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#4fc3f7] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {editorMode === "edit" && (
                      <span className="text-[11px] text-[#6b6b78]">
                        Server name is immutable in V1. Create a new server to rename it.
                      </span>
                    )}
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-medium text-[#9c9cab]">Type</span>
                    <select
                      value={form.serverType}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          serverType: e.target.value as McpServerType,
                        }))}
                      className="h-10 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#4fc3f7]"
                    >
                      <option value="command">Command</option>
                      <option value="http">HTTP</option>
                      <option value="sse">SSE</option>
                    </select>
                  </label>

                  {form.serverType === "command" ? (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-[12px] font-medium text-[#9c9cab]">Command</span>
                        <input
                          type="text"
                          value={form.command}
                          onChange={(e) =>
                            setForm((current) => ({ ...current, command: e.target.value }))}
                          placeholder="npx"
                          className="h-10 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#4fc3f7]"
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-[12px] font-medium text-[#9c9cab]">Args</span>
                        <textarea
                          value={form.argsText}
                          onChange={(e) =>
                            setForm((current) => ({ ...current, argsText: e.target.value }))}
                          rows={4}
                          spellCheck={false}
                          placeholder={"One argument per line\n-y\n@modelcontextprotocol/server-filesystem"}
                          className="resize-none rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 py-2 font-mono text-[12px] text-[#c0c0c8] outline-none focus:border-[#4fc3f7]"
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-[12px] font-medium text-[#9c9cab]">Env</span>
                        <textarea
                          value={form.envText}
                          onChange={(e) =>
                            setForm((current) => ({ ...current, envText: e.target.value }))}
                          rows={5}
                          spellCheck={false}
                          placeholder={'{\n  "GITHUB_TOKEN": "..." \n}'}
                          className="resize-none rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 py-2 font-mono text-[12px] text-[#c0c0c8] outline-none focus:border-[#4fc3f7]"
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="grid gap-1.5">
                        <span className="text-[12px] font-medium text-[#9c9cab]">URL</span>
                        <input
                          type="text"
                          value={form.url}
                          onChange={(e) =>
                            setForm((current) => ({ ...current, url: e.target.value }))}
                          placeholder="https://example.com/mcp"
                          className="h-10 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 text-sm text-[#e8e8ec] outline-none focus:border-[#4fc3f7]"
                        />
                      </label>

                      <label className="grid gap-1.5">
                        <span className="text-[12px] font-medium text-[#9c9cab]">Headers</span>
                        <textarea
                          value={form.headersText}
                          onChange={(e) =>
                            setForm((current) => ({ ...current, headersText: e.target.value }))}
                          rows={5}
                          spellCheck={false}
                          placeholder={'{\n  "Authorization": "Bearer ..." \n}'}
                          className="resize-none rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 py-2 font-mono text-[12px] text-[#c0c0c8] outline-none focus:border-[#4fc3f7]"
                        />
                      </label>
                    </>
                  )}

                  {formError && (
                    <p className="text-[12px] text-red-400">{formError}</p>
                  )}
                </div>
              </div>
            )}

            {!loadingDetail && (
              <div className="flex justify-end gap-2 border-t border-[#3a3a42] px-6 py-4">
                <button
                  onClick={closeEditor}
                  disabled={submitting}
                  className="rounded-lg border border-[#2a2a32] px-3 py-1.5 text-xs text-[#8a8a96] transition-colors hover:bg-[#2a2a32] hover:text-[#e8e8ec] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    void handleSubmit();
                  }}
                  disabled={submitting}
                  className="rounded-lg bg-[#4fc3f7] px-3 py-1.5 text-xs font-medium text-[#1e1e23] transition-colors hover:bg-[#4fc3f7]/80 disabled:opacity-40"
                >
                  {primaryButtonLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { FileJson2, Plug } from "lucide-react";
import { useAppStore } from "../lib/store";
import { McpLiveServersView } from "./McpLiveServersView";
import { McpProfilesView } from "./McpProfilesView";

type McpTab = "profiles" | "live";

export function McpPage() {
  const activeContext = useAppStore((s) => s.activeContext);
  const mcpProfiles = useAppStore((s) => s.mcpProfiles);
  const mcpServers = useAppStore((s) => s.mcpServers);
  const [activeTab, setActiveTab] = useState<McpTab>("profiles");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-[#2a2a32] bg-[#202027] px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-semibold text-[#e8e8ec]">MCP</h1>
            <p className="mt-1 text-[12px] text-[#8a8a96]">
              Profile-first management for project MCP, with the existing live manager kept as an advanced view.
            </p>
          </div>
          <span className="rounded-full border border-[#3a3a42] bg-[#2a2a32] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9c9cab]">
            {activeContext === "project" ? "Project Context" : "Global Context"}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("profiles")}
            aria-label="Profiles tab"
            aria-pressed={activeTab === "profiles"}
            className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
              activeTab === "profiles"
                ? "border-[#4fc3f7]/30 bg-[#4fc3f7]/10 text-[#4fc3f7]"
                : "border-[#3a3a42] bg-[#2a2a32] text-[#8a8a96] hover:bg-[#313138] hover:text-[#d0d0d8]"
            }`}
          >
            <FileJson2 className="h-4 w-4" />
            Profiles
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
              {mcpProfiles.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("live")}
            aria-label="Live Servers tab"
            aria-pressed={activeTab === "live"}
            className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors ${
              activeTab === "live"
                ? "border-[#4fc3f7]/30 bg-[#4fc3f7]/10 text-[#4fc3f7]"
                : "border-[#3a3a42] bg-[#2a2a32] text-[#8a8a96] hover:bg-[#313138] hover:text-[#d0d0d8]"
            }`}
          >
            <Plug className="h-4 w-4" />
            Live Servers
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px]">
              {mcpServers.length}
            </span>
          </button>
        </div>
      </div>

      {activeTab === "profiles" ? (
        <McpProfilesView onOpenLiveServers={() => setActiveTab("live")} />
      ) : (
        <McpLiveServersView />
      )}
    </div>
  );
}

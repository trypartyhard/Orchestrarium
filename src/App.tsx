import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./lib/store";
import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { frontendReady, autoImportClaudeMd, setActiveContext, setProjectDir } from "./bindings";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { AgentList } from "./components/AgentList";
import { StatusBar } from "./components/StatusBar";
import { Toast } from "./components/Toast";
import { SetupPage } from "./components/SetupPage";
import { LibraryPage } from "./components/LibraryPage";
import { ClaudeMdPage } from "./components/ClaudeMdPage";

function App() {
  const loadSection = useAppStore((s) => s.loadSection);
  const activeSection = useAppStore((s) => s.activeSection);
  const loadSetups = useAppStore((s) => s.loadSetups);
  const activeContext = useAppStore((s) => s.activeContext);
  const projectDir = useAppStore((s) => s.projectDir);
  const storeSetProjectDir = useAppStore((s) => s.setProjectDir);

  const showProjectEmptyState = activeContext === "project" && !projectDir;

  useEffect(() => {
    // Auto-import existing CLAUDE.md on first run
    autoImportClaudeMd().catch(() => {});

    // Restore context from localStorage
    const savedContext = localStorage.getItem("orchestrarium-context") || "global";
    const savedProject = localStorage.getItem("orchestrarium-project-dir");
    const restoreAndLoad = async () => {
      try {
        let resolvedContext = "global";
        if (savedProject) {
          try {
            await setProjectDir(savedProject);
            resolvedContext = savedContext;
          } catch {
            localStorage.removeItem("orchestrarium-project-dir");
            useAppStore.setState({ projectDir: null, activeContext: "global" });
          }
        }
        const ctx = resolvedContext as "global" | "project";
        await setActiveContext(ctx);
        useAppStore.setState({ activeContext: ctx });
      } catch { /* ignore */ }

      // Load after context is fully restored
      loadSection(activeSection);
      loadSetups();
    };
    restoreAndLoad();

    // Signal frontend is ready for watcher events
    frontendReady().catch(() => {});

    // Listen for filesystem changes from Rust watcher (debounced, silent)
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = listen("fs-changed", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        useAppStore.getState().silentReload();
      }, 300);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#18181e] text-[#e8e8ec]">
      <TitleBar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col border-t border-l border-[#222228]">
          {showProjectEmptyState ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <FolderOpen className="h-12 w-12 text-[#3a3a42]" />
              <p className="text-sm text-[#56565f]">No project selected</p>
              <button
                onClick={async () => {
                  const selected = await open({ directory: true });
                  if (selected) await storeSetProjectDir(selected);
                }}
                className="rounded-lg border border-[#66bb6a]/30 bg-[#66bb6a]/10 px-4 py-2 text-sm font-medium text-[#66bb6a] transition-colors hover:bg-[#66bb6a]/20"
              >
                Open Project Folder
              </button>
            </div>
          ) : activeSection === "setup" ? (
            <SetupPage />
          ) : activeSection === "library" ? (
            <LibraryPage />
          ) : activeSection === "claude-md" ? (
            <ClaudeMdPage />
          ) : (
            <>
              <Header />
              <AgentList />
            </>
          )}
          </div>
        </div>
        <StatusBar />
      </div>
      <Toast />
    </div>
  );
}

export default App;

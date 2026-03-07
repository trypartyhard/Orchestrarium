import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./lib/store";
import { frontendReady } from "./bindings";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { AgentList } from "./components/AgentList";
import { StatusBar } from "./components/StatusBar";
import { Toast } from "./components/Toast";
import { SetupPage } from "./components/SetupPage";
import { LibraryPage } from "./components/LibraryPage";

function App() {
  const loadSection = useAppStore((s) => s.loadSection);
  const activeSection = useAppStore((s) => s.activeSection);
  const loadSetups = useAppStore((s) => s.loadSetups);

  useEffect(() => {
    // Initial load
    loadSection(activeSection);
    loadSetups();

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
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col border-t border-l border-[#222228]">
        {activeSection === "setup" ? (
          <SetupPage />
        ) : activeSection === "library" ? (
          <LibraryPage />
        ) : (
          <>
            <Header />
            <AgentList />
          </>
        )}
        <StatusBar />
        </div>
      </div>
      <Toast />
    </div>
  );
}

export default App;

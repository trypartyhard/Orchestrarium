import { X } from "lucide-react";
import { useAppStore } from "../lib/store";

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  if (!toast.visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/20 px-4 py-2.5 text-sm text-red-300 shadow-lg backdrop-blur">
      <span>{toast.message}</span>
      <button
        onClick={hideToast}
        className="text-red-400 hover:text-red-300"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

import { X } from "lucide-react";
import { useAppStore } from "../lib/store";

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  if (!toast.visible) return null;

  const isError = toast.type === "error";

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur ${
      isError
        ? "border-red-500/30 bg-red-500/20 text-red-300"
        : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
    }`}>
      <span>{toast.message}</span>
      <button
        onClick={hideToast}
        aria-label="Dismiss notification"
        className={isError ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

import { X } from "lucide-react";
import { useAppStore } from "../lib/store";
import { Toggle } from "./Toggle";
import { useEscapeKey } from "../lib/useEscapeKey";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  useEscapeKey(onClose);

  const advancedFeatures = useAppStore((s) => s.advancedFeatures);
  const setAdvancedFeatures = useAppStore((s) => s.setAdvancedFeatures);
  const skipGroupWarnings = useAppStore((s) => s.skipGroupWarnings);
  const setSkipGroupWarnings = useAppStore((s) => s.setSkipGroupWarnings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex w-[400px] flex-col rounded-xl border border-[#3a3a42] bg-[#1e1e23] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3a3a42] px-6 py-4">
          <h2 className="text-[15px] font-semibold text-[#e8e8ec]">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-[#e8e8ec]">
                Advanced Features
              </span>
              <span className="text-[12px] text-[#56565f]">
                Enable CLAUDE.md profile manager
              </span>
            </div>
            <Toggle
              enabled={advancedFeatures}
              onToggle={() => setAdvancedFeatures(!advancedFeatures)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-[#e8e8ec]">
                Skip Group Notifications
              </span>
              <span className="text-[12px] text-[#56565f]">
                Recommended for experienced users only
              </span>
            </div>
            <Toggle
              enabled={skipGroupWarnings}
              onToggle={() => setSkipGroupWarnings(!skipGroupWarnings)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

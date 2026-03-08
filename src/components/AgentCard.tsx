import { Plus, Check, Eye } from "lucide-react";
import { useState } from "react";
import type { AgentInfo } from "../bindings";
import { useAppStore } from "../lib/store";
import { ColorDot } from "./ColorDot";
import { Badge } from "./Badge";
import { PreviewModal } from "./PreviewModal";

interface AgentCardProps {
  item: AgentInfo;
  onAddToSetup?: (item: AgentInfo) => void;
}

export function AgentCard({ item, onAddToSetup }: AgentCardProps) {
  const setupIds = useAppStore((s) => s.setupIds);
  const addToSetup = useAppStore((s) => s.addToSetup);
  const inSetup = setupIds.has(item.id);
  const [showPreview, setShowPreview] = useState(false);

  const handleAdd = () => {
    if (onAddToSetup) {
      onAddToSetup(item);
    } else {
      addToSetup(item.id);
    }
  };

  return (
    <>
      <div
        className="flex items-center gap-3 rounded-lg border border-[#3a3a42] bg-[#27272c] px-3 py-2.5 transition-colors hover:bg-[#313138]"
      >
        <ColorDot color={item.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-[#dddde4]">
              {item.name}
            </span>
            <Badge
              text={item.scope}
              variant={item.scope === "global" ? "info" : "project"}
            />
            {item.invalid_config && <Badge text="invalid config" variant="error" />}
          </div>
          {item.description && (
            <p className="truncate text-xs text-[#56565f]">{item.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowPreview(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6b6b78] transition-colors hover:bg-[#4fc3f7]/10 hover:text-[#4fc3f7]"
          title="Preview"
          aria-label="Preview item content"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        {inSetup ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-3 py-1.5 text-xs font-medium text-[#00d4aa]">
            <Check className="h-3 w-3" />
            In Setup
          </span>
        ) : (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 px-3 py-1.5 text-xs font-medium text-[#4fc3f7] transition-colors hover:bg-[#4fc3f7]/20"
          >
            <Plus className="h-3 w-3" />
            Add to Setup
          </button>
        )}
      </div>
      {showPreview && (
        <PreviewModal
          name={item.name}
          path={item.path}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

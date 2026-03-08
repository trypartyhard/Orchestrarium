import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { readItemContent } from "../bindings";
import { useEscapeKey } from "../lib/useEscapeKey";

interface PreviewModalProps {
  name: string;
  path: string;
  onClose: () => void;
}

export function PreviewModal({ name, path, onClose }: PreviewModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  useEffect(() => {
    readItemContent(path)
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [path]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-[560px] flex-col rounded-xl border border-[#3a3a42] bg-[#1e1e23] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#3a3a42] px-6 py-4">
          <h2 className="truncate text-[15px] font-semibold text-[#e8e8ec]">
            {name}
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#6b6b78] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5">
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : content === null ? (
            <p className="text-sm text-[#56565f]">Loading...</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-[#c0c0c8]">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

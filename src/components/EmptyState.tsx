import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  section: string;
}

export function EmptyState({ section }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#6b6b78]">
      <FolderOpen className="h-12 w-12 opacity-50" />
      <p className="text-sm">No {section} found</p>
      <p className="text-xs">
        Place <code className="text-[#8a8a96]">.md</code> files in{" "}
        <code className="text-[#8a8a96]">~/.claude/{section}/</code>
      </p>
    </div>
  );
}

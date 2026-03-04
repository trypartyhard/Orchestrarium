import { useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { useAppStore } from "../lib/store";

export function SearchBar() {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 h-4 w-4 text-[#555577]" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search... (Ctrl+F)"
        className="h-8 w-64 rounded-md border border-[#2a2a44] bg-[#1a1a2e] pl-8 pr-3 text-sm text-[#d0d0e8] placeholder-[#555577] outline-none focus:border-[#00d4aa]"
      />
    </div>
  );
}

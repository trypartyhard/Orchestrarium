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
      <Search className="absolute left-2.5 h-4 w-4 text-[#6b6b78]" />
      <input
        ref={inputRef}
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search... (Ctrl+F)"
        className="h-8 w-64 rounded-md border border-[#3a3a42] bg-[#27272c] pl-8 pr-3 text-sm text-[#e8e8ec] placeholder-[#6b6b78] outline-none focus:border-[#4fc3f7]"
      />
    </div>
  );
}

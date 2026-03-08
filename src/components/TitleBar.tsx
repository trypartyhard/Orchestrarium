import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

function LogoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="28" x2="32" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4DE3FF" />
          <stop offset="0.55" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#2AF7C5" />
        </linearGradient>
        <filter id="logoGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feColorMatrix in="b" type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.65 0" result="c" />
          <feMerge>
            <feMergeNode in="c" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#logoGlow)">
        <path d="M2 24 C7 12, 16 9, 23 13 C27 15, 30 19, 31 23"
          stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M5 28 C10 18, 17 16, 23 18 C26 19, 28 22, 29 25"
          stroke="url(#logoGrad)" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.5" />
        <path d="M9 27 L24 12" stroke="#f0f0f8" strokeWidth="3" strokeLinecap="round" />
        <path d="M23 13 L27 9" stroke="url(#logoGrad)" strokeWidth="3" strokeLinecap="round" />
        <path d="M7 29 L10.5 25.5" stroke="#f0f0f8" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function TitleBar() {
  return (
    <div
      className="relative flex h-11 shrink-0 items-center bg-[#111116]"
      data-tauri-drag-region
    >
      {/* Logo left */}
      <div className="pl-4" data-tauri-drag-region>
        <LogoIcon />
      </div>

      {/* Title centered */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none">
        <span className="text-[14px] font-bold tracking-[1.5px] text-[#f0f0f8]">
          ORCHESTRARIUM
        </span>
        <span className="h-1 w-1 rounded-full bg-gradient-to-r from-[#4DE3FF] via-[#7C5CFF] to-[#2AF7C5] opacity-50" />
        <span className="text-[11px] text-[#7a7a88]">
          Agent & Skill Orchestration
        </span>
      </div>

      {/* Spacer for drag */}
      <div className="flex-1" data-tauri-drag-region />

      {/* Window Controls */}
      <div className="flex h-full items-center">
        <button
          onClick={() => appWindow.minimize()}
          aria-label="Minimize window"
          className="flex h-full w-12 items-center justify-center text-[#7a7a88] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8]"
        >
          <svg width="12" height="2" viewBox="0 0 12 2">
            <line x1="0" y1="1" x2="12" y2="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          aria-label="Maximize window"
          className="flex h-full w-12 items-center justify-center text-[#7a7a88] transition-colors hover:bg-[#2a2a32] hover:text-[#c0c0c8]"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          aria-label="Close window"
          className="flex h-full w-12 items-center justify-center text-[#7a7a88] transition-colors hover:bg-[#e81123] hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

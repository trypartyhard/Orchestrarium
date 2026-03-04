interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function Toggle({ enabled, onToggle, disabled }: ToggleProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
      style={{ backgroundColor: enabled ? "#00d4aa" : "#555577" }}
      aria-checked={enabled}
      role="switch"
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150"
        style={{
          transform: enabled ? "translateX(18px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}

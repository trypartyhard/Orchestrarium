import { motion } from "framer-motion";

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function Toggle({ enabled, onToggle, disabled }: ToggleProps) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
      animate={{ backgroundColor: enabled ? "#4fc3f7" : "#6b6b78" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      aria-checked={enabled}
      role="switch"
    >
      <motion.span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 18 : 3 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      />
    </motion.button>
  );
}

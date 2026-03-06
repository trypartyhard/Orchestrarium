interface BadgeProps {
  text: string;
  variant?: "error" | "info" | "project";
}

export function Badge({ text, variant = "info" }: BadgeProps) {
  const colors =
    variant === "error"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : variant === "project"
        ? "bg-[#ffa726]/10 text-[#ffa726] border-[#ffa726]/30"
        : "bg-[#66bb6a]/10 text-[#66bb6a] border-[#66bb6a]/30";

  return (
    <span
      className={`inline-block rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] leading-tight ${colors}`}
    >
      {text}
    </span>
  );
}

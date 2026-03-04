interface BadgeProps {
  text: string;
  variant?: "error" | "info";
}

export function Badge({ text, variant = "info" }: BadgeProps) {
  const colors =
    variant === "error"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-[#2a2a44] text-[#8888aa] border-[#2a2a44]";

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] leading-tight ${colors}`}
    >
      {text}
    </span>
  );
}

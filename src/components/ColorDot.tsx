interface ColorDotProps {
  color: string | null;
}

export function ColorDot({ color }: ColorDotProps) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color || "#6b6b78" }}
    />
  );
}

const ALLOWED_CHARS = /^[\p{L}\p{N}\s\-_]+$/u;
const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null; // empty is handled by disabled button
  if (trimmed.length > 100) return "Name is too long (max 100 characters)";
  if (!ALLOWED_CHARS.test(trimmed)) return "Only letters, numbers, spaces, hyphens and underscores allowed";
  if (WINDOWS_RESERVED.test(trimmed)) return "This name is reserved by Windows";
  return null;
}

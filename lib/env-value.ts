/** Trim Hostinger / .env wrapping quotes so a pasted `"value"` still works. */
export function cleanEnvValue(value: string | undefined | null): string {
  let v = (value ?? "").trim();
  for (let i = 0; i < 3; i++) {
    if (
      (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
      (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
    ) {
      v = v.slice(1, -1).trim();
    } else {
      break;
    }
  }
  return v;
}

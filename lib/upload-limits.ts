/** Max certificate template background image size (62 MB). */
export const CERTIFICATE_BACKGROUND_MAX_BYTES = 62 * 1024 * 1024;

export const CERTIFICATE_BACKGROUND_MAX_LABEL = "62MB";

export function formatBytesLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes} bytes`;
}

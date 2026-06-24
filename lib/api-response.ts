/** Parse JSON from a fetch Response; handles empty bodies (e.g. proxy body-size limit). */
export async function readApiJson<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (res.status === 413) {
      throw new Error("File is too large for the server. Try a smaller image or contact your host.");
    }
    throw new Error(
      `Upload failed: server returned an empty response (HTTP ${res.status}). The file may exceed the server body size limit.`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Upload failed: invalid server response (HTTP ${res.status}). The file may be too large for the server.`
    );
  }
}

type StudentsListResponse = {
  data?: unknown[];
  nextCursor?: string | null;
  hasNextPage?: boolean;
  error?: string;
};

/** Walk cursor pages so org-admin lists are not truncated at 50/100. */
export async function fetchAllStudents(
  searchParams: Record<string, string | undefined> = {}
): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 40; i++) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("limit", "100");
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`/api/students?${params}`);
    const json = (await res.json().catch(() => ({}))) as StudentsListResponse;
    if (!res.ok) throw new Error(json.error || "Failed to load students");
    const rows = Array.isArray(json.data) ? json.data : [];
    all.push(...rows);
    if (!json.hasNextPage || !json.nextCursor) break;
    cursor = json.nextCursor;
  }
  return all;
}

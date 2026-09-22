import { DELETE, PATCH } from "@/app/api/class-recordings/[id]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alias — Hostinger WAF 403s DELETE/PATCH /api/class-recordings/:id. */
export { DELETE, PATCH };

import { POSTClassRecording } from "@/lib/api-trash-recordings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bland path + multipart body — Hostinger WAF 403s POST /api/class-recordings. */
export async function POST(request: Request) {
  return POSTClassRecording(request);
}

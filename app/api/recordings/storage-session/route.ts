import { handleVideoResumableGet, handleVideoResumablePost } from "@/lib/video-resumable-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a GCS resumable video session. Path avoids Hostinger /api/uploads WAF rules. */
export async function GET() {
  return handleVideoResumableGet();
}

export async function POST(request: Request) {
  return handleVideoResumablePost(request);
}

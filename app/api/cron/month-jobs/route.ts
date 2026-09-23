import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { fillCurrentMonthJobs } from "@/lib/job-month-run";
import { logAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function bearerMatches(header: string | null, secret: string) {
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fillCurrentMonthJobs();
    if (result.inserted > 0 || result.closedPrevious > 0) {
      await logAction({
        role: "super_admin",
        action: "CRON_MONTH_JOBS_IMPORTED",
        entity: "JobPosting",
        metadata: {
          inserted: result.inserted,
          monthImported: result.monthImported,
          monthLabel: result.monthLabel,
          closedPrevious: result.closedPrevious,
          sources: result.sources,
          done: result.done,
        },
      });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] month-jobs failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "month job import failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

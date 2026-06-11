import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { liveClasses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // PERF: Lightweight status check endpoint polled by student client
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 });
  }

  // Fetch only id and status to minimize bandwidth/query cost
  const classes = await db
    .select({
      id: liveClasses.id,
      status: liveClasses.status,
    })
    .from(liveClasses)
    .where(
      and(
        eq(liveClasses.batchId, batchId),
        isNull(liveClasses.deletedAt)
      )
    );

  return NextResponse.json(classes);
}

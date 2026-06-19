import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeyUsageLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;
  const limit = Math.min(
    parseInt(new URL(request.url).searchParams.get("limit") ?? "50", 10),
    200
  );

  const logs = await db
    .select()
    .from(apiKeyUsageLogs)
    .where(eq(apiKeyUsageLogs.apiKeyId, id))
    .orderBy(desc(apiKeyUsageLogs.createdAt))
    .limit(limit);

  return NextResponse.json({ data: logs });
}

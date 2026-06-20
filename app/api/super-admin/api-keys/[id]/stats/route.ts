import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getApiKeyStats } from "@/lib/widget/widget-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { id } = await params;

  const stats = await getApiKeyStats(id);
  if (!stats) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(stats);
}

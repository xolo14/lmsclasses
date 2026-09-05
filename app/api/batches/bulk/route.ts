import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { batches, liveCourses, organisations } from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import { logAction, getClientIp } from "@/lib/audit";
import { and, eq, ilike, isNull } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error, session } = await requireAuth(["super_admin", "manager"]);
  if (error) return error;

  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Input must be an array of batch records" }, { status: 400 });
    }

    if (body.length === 0) {
      return NextResponse.json({ error: "No records provided to import." }, { status: 400 });
    }

    // Pre-fetch all live courses and organisations for fast, case-insensitive lookups
    const [allCourses, allOrgs] = await Promise.all([
      db
        .select({ id: liveCourses.id, title: liveCourses.title })
        .from(liveCourses)
        .where(isNull(liveCourses.deletedAt)),
      db
        .select({ id: organisations.id, name: organisations.name })
        .from(organisations),
    ]);

    const parsedBatches: any[] = [];

    for (let i = 0; i < body.length; i++) {
      const row = body[i];
      const name = String(row.name || row.batchName || row["Batch Name"] || "").trim();
      const courseInput = String(row.courseId || row.courseTitle || row.course || row["Course Title"] || row["Course"] || "").trim();
      const orgInput = String(row.organisationId || row.orgName || row.organisation || row["Organisation Name"] || row["Organisation"] || "").trim();
      const startDateInput = row.startDate || row["Start Date"];
      const endDateInput = row.endDate || row["End Date"];
      const maxSlotsInput = row.maxSlots || row["Max Slots"];

      if (!name) {
        return NextResponse.json(
          { error: `Row ${i + 1}: Batch Name is required.` },
          { status: 400 }
        );
      }

      if (!courseInput) {
        return NextResponse.json(
          { error: `Row ${i + 1}: Course Title or Course ID is required.` },
          { status: 400 }
        );
      }

      // Match course by ID or Title
      let matchedCourse = allCourses.find(
        (c) => c.id === courseInput || c.title.toLowerCase() === courseInput.toLowerCase()
      );
      if (!matchedCourse) {
        return NextResponse.json(
          { error: `Row ${i + 1}: Course '${courseInput}' not found.` },
          { status: 400 }
        );
      }

      // Match organisation if provided
      let matchedOrgId: string | null = null;
      if (orgInput) {
        const matchedOrg = allOrgs.find(
          (o) => o.id === orgInput || o.name.toLowerCase() === orgInput.toLowerCase()
        );
        if (!matchedOrg) {
          return NextResponse.json(
            { error: `Row ${i + 1}: Organisation '${orgInput}' not found.` },
            { status: 400 }
          );
        }
        matchedOrgId = matchedOrg.id;
      }

      let startDate: Date | null = null;
      if (startDateInput) {
        const d = new Date(startDateInput);
        if (!isNaN(d.getTime())) startDate = d;
      }

      let endDate: Date | null = null;
      if (endDateInput) {
        const d = new Date(endDateInput);
        if (!isNaN(d.getTime())) endDate = d;
      }

      let maxSlots = 30;
      if (maxSlotsInput !== undefined && maxSlotsInput !== null && maxSlotsInput !== "") {
        const parsedNum = parseInt(String(maxSlotsInput), 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          maxSlots = parsedNum;
        }
      }

      parsedBatches.push({
        name,
        courseId: matchedCourse.id,
        organisationId: matchedOrgId,
        startDate,
        endDate,
        maxSlots,
        createdBy: session!.user.id,
      });
    }

    const inserted = await db
      .insert(batches)
      .values(parsedBatches)
      .returning();

    for (const batch of inserted) {
      try {
        await logAction({
          userId: session!.user.id,
          role: session!.user.role,
          action: "CREATED_BATCH",
          entity: "Batch",
          entityId: batch.id,
          metadata: { name: batch.name, importMode: "bulk" },
          ipAddress: getClientIp(request),
        });
      } catch (auditErr) {
        console.error(`[POSTBulkBatches] Audit logging failed for batch ${batch.id}:`, auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      successCount: inserted.length,
      batches: inserted,
    }, { status: 201 });

  } catch (err) {
    console.error("[POSTBulkBatches] error:", err);
    const msg = err instanceof Error ? err.message : "Failed to bulk import batches";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

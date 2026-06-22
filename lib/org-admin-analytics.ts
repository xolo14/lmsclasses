import { and, desc, eq, gte, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
  liveCourses,
  payments,
  recordCourses,
  slots,
  studentCourses,
  users,
} from "@/lib/db/schema";

const MONTHS_BACK = 6;

function monthKey(date: Date): string {
  return date.toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

function fillMonthlySeries(
  keys: string[],
  rows: { month: string; value: number }[],
  valueKey: string
): { month: string; [key: string]: string | number }[] {
  const map = new Map(rows.map((r) => [r.month, r.value]));
  return keys.map((month) => ({ month, [valueKey]: map.get(month) ?? 0 }));
}

export type OrgAdminAnalytics = {
  summary: {
    totalStudents: number;
    activeLiveCourses: number;
    slotsRemaining: number;
    slotsUsed: number;
    paymentsMade: number;
    totalSpent: number;
    liveEnrollments: number;
    recordEnrollments: number;
  };
  spendingByMonth: { month: string; amount: number }[];
  enrollmentsByMonth: { month: string; count: number }[];
  slotsByCourse: { courseTitle: string; used: number; total: number }[];
  courseTypeSplit: { name: string; value: number }[];
  recentPayments: {
    id: string;
    courseTitle: string | null;
    amount: string;
    status: string;
    createdAt: string;
  }[];
  recentActivity: { id: string; action: string; createdAt: string }[];
};

export async function getOrgAdminAnalytics(
  organisationId: string,
  orgAdminUserId: string
): Promise<OrgAdminAnalytics> {
  const monthKeys = lastNMonthKeys(MONTHS_BACK);
  const since = new Date();
  since.setMonth(since.getMonth() - (MONTHS_BACK - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const orgStudentFilter = and(eq(users.role, "student"), eq(users.organisationId, organisationId));
  const orgPaymentFilter = and(
    eq(payments.organisationId, organisationId),
    or(isNotNull(payments.liveCourseId), isNotNull(payments.recordCourseId))!
  );
  const orgEnrollmentFilter = and(
    eq(studentCourses.organisationId, organisationId),
    eq(studentCourses.isActive, true)
  );

  const [
    [totalStudents],
    [paymentsMade],
    [totalSpent],
    [liveEnrollments],
    [recordEnrollments],
    activeCoursesRows,
    orgSlots,
    spendingRows,
    enrollmentRows,
    slotsRows,
    recentPayments,
    recentActivity,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(orgStudentFilter),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(and(orgPaymentFilter, eq(payments.status, "success"))),
    db
      .select({ sum: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(and(orgPaymentFilter, eq(payments.status, "success"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentCourses)
      .where(and(orgEnrollmentFilter, isNotNull(studentCourses.liveCourseId))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentCourses)
      .where(and(orgEnrollmentFilter, isNotNull(studentCourses.recordCourseId))),
    db
      .select({
        count: sql<number>`count(distinct ${slots.courseId})::int`,
      })
      .from(slots)
      .innerJoin(liveCourses, eq(slots.courseId, liveCourses.id))
      .where(
        and(
          eq(slots.organisationId, organisationId),
          eq(liveCourses.isActive, true),
          isNull(liveCourses.deletedAt)
        )
      ),
    db
      .select({ totalSlots: slots.totalSlots, usedSlots: slots.usedSlots })
      .from(slots)
      .where(eq(slots.organisationId, organisationId)),
    db
      .select({
        month: sql<string>`to_char(${payments.createdAt}, 'Mon YY')`,
        amount: sql<string>`coalesce(sum(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(
        and(orgPaymentFilter, eq(payments.status, "success"), gte(payments.createdAt, since))
      )
      .groupBy(sql`to_char(${payments.createdAt}, 'Mon YY')`, sql`date_trunc('month', ${payments.createdAt})`)
      .orderBy(sql`date_trunc('month', ${payments.createdAt})`),
    db
      .select({
        month: sql<string>`to_char(${studentCourses.enrolledAt}, 'Mon YY')`,
        count: sql<number>`count(*)::int`,
      })
      .from(studentCourses)
      .where(and(orgEnrollmentFilter, gte(studentCourses.enrolledAt, since)))
      .groupBy(
        sql`to_char(${studentCourses.enrolledAt}, 'Mon YY')`,
        sql`date_trunc('month', ${studentCourses.enrolledAt})`
      )
      .orderBy(sql`date_trunc('month', ${studentCourses.enrolledAt})`),
    db
      .select({
        courseTitle: sql<string>`coalesce(${liveCourses.title}, ${recordCourses.title}, 'Unknown')`,
        used: sql<number>`coalesce(${slots.usedSlots}, 0)::int`,
        total: slots.totalSlots,
      })
      .from(slots)
      .leftJoin(liveCourses, eq(slots.courseId, liveCourses.id))
      .leftJoin(recordCourses, eq(slots.recordCourseId, recordCourses.id))
      .where(eq(slots.organisationId, organisationId))
      .orderBy(desc(slots.totalSlots)),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        status: payments.status,
        createdAt: payments.createdAt,
        courseTitle: sql<string | null>`coalesce(${liveCourses.title}, ${recordCourses.title})`,
      })
      .from(payments)
      .leftJoin(liveCourses, eq(payments.liveCourseId, liveCourses.id))
      .leftJoin(recordCourses, eq(payments.recordCourseId, recordCourses.id))
      .where(orgPaymentFilter)
      .orderBy(desc(payments.createdAt))
      .limit(8),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(eq(auditLogs.userId, orgAdminUserId), sql`${auditLogs.action} LIKE '%STUDENT%'`)
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
  ]);

  let slotsRemaining = 0;
  let slotsUsed = 0;
  for (const s of orgSlots) {
    const used = s.usedSlots ?? 0;
    slotsUsed += used;
    slotsRemaining += s.totalSlots - used;
  }

  const spendingByMonth = fillMonthlySeries(
    monthKeys,
    spendingRows.map((r) => ({ month: r.month, value: parseFloat(r.amount) })),
    "amount"
  ) as { month: string; amount: number }[];

  const enrollmentsByMonth = fillMonthlySeries(
    monthKeys,
    enrollmentRows.map((r) => ({ month: r.month, value: r.count })),
    "count"
  ) as { month: string; count: number }[];

  const liveCount = liveEnrollments?.count ?? 0;
  const recordCount = recordEnrollments?.count ?? 0;

  return {
    summary: {
      totalStudents: totalStudents?.count ?? 0,
      activeLiveCourses: activeCoursesRows[0]?.count ?? 0,
      slotsRemaining,
      slotsUsed,
      paymentsMade: paymentsMade?.count ?? 0,
      totalSpent: parseFloat(totalSpent?.sum ?? "0"),
      liveEnrollments: liveCount,
      recordEnrollments: recordCount,
    },
    spendingByMonth,
    enrollmentsByMonth,
    slotsByCourse: slotsRows.map((r) => ({
      courseTitle: r.courseTitle,
      used: r.used,
      total: r.total,
    })),
    courseTypeSplit: [
      { name: "Live", value: liveCount },
      { name: "Record", value: recordCount },
    ].filter((x) => x.value > 0),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      courseTitle: p.courseTitle,
      amount: p.amount,
      status: p.status ?? "pending",
      createdAt: p.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      createdAt: a.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
  };
}

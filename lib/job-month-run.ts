import { randomBytes } from "crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { companies, hrUsers, jobPostings } from "@/lib/db/schema";
import {
  IMPORT_BATCH_SIZE,
  MONTHLY_JOB_TARGET,
  PLATFORM_COMPANY_DOMAIN,
  PLATFORM_COMPANY_NAME,
  PLATFORM_HR_DESIGNATION,
  PLATFORM_HR_EMAIL,
  PLATFORM_HR_NAME,
  buildMonthJobCatalog,
  currentMonthLabel,
  fetchPublicMonthJobs,
  jobDraftKey,
  mergeMonthJobDrafts,
  startOfCurrentIstMonth,
  type MonthJobDraft,
} from "@/lib/job-month-import";

export type MonthImportResult = {
  done: boolean;
  inserted: number;
  monthImported: number;
  monthTarget: number;
  monthLabel: string;
  closedPrevious: number;
  sources: string[];
  errors: string[];
};

async function ensurePlatformJobPoster() {
  const [existingHr] = await db
    .select()
    .from(hrUsers)
    .where(eq(hrUsers.email, PLATFORM_HR_EMAIL))
    .limit(1);
  if (existingHr) return existingHr;

  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.domain, PLATFORM_COMPANY_DOMAIN))
    .limit(1);

  const company =
    existingCompany ??
    (
      await db
        .insert(companies)
        .values({
          companyName: PLATFORM_COMPANY_NAME,
          domain: PLATFORM_COMPANY_DOMAIN,
          website: null,
          registrationDetails: { source: "super_admin_month_import" },
          verificationStatus: "verified",
          isActive: true,
        })
        .returning()
    )[0];

  if (!company) {
    throw new Error("Could not create the platform job board company.");
  }

  const [hr] = await db
    .insert(hrUsers)
    .values({
      companyId: company.id,
      name: PLATFORM_HR_NAME,
      email: PLATFORM_HR_EMAIL,
      passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      role: "hr",
      designation: PLATFORM_HR_DESIGNATION,
      isActive: true,
    })
    .returning();

  if (!hr) {
    throw new Error("Could not create the Super Admin job poster.");
  }
  return hr;
}

function draftsToRows(hr: { id: string; companyId: string }, drafts: MonthJobDraft[]) {
  return drafts.map((draft) => ({
    hrId: hr.id,
    companyId: hr.companyId,
    title: draft.title,
    organisationName: draft.organisationName,
    location: draft.location,
    employmentType: draft.employmentType,
    stipend: draft.stipend,
    salary: draft.salary,
    ctc: draft.ctc,
    experienceRequired: draft.experienceRequired,
    description: draft.description,
    responsibilities: draft.responsibilities,
    requiredSkills: draft.requiredSkills,
    lastDateToApply: draft.applicationDeadline,
    applicationDeadline: draft.applicationDeadline,
    openings: 1,
    status: "active" as const,
    active: true,
    createdAt: draft.postedAt,
    updatedAt: draft.postedAt,
  }));
}

export async function runMonthJobImport(options: {
  target?: number;
  maxInsert?: number;
  includeBoards?: boolean;
  closePreviousMonth?: boolean;
  now?: Date;
} = {}): Promise<MonthImportResult> {
  const now = options.now ?? new Date();
  const target = Math.min(Math.max(Number(options.target) || MONTHLY_JOB_TARGET, 1), MONTHLY_JOB_TARGET);
  const maxInsert = Math.min(Math.max(Number(options.maxInsert) || MONTHLY_JOB_TARGET, 1), MONTHLY_JOB_TARGET);
  const includeBoards = options.includeBoards !== false;
  const closePreviousMonth = options.closePreviousMonth !== false;
  const monthStart = startOfCurrentIstMonth(now);
  const monthLabel = currentMonthLabel(now);

  const hr = await ensurePlatformJobPoster();

  let closedPrevious = 0;
  if (closePreviousMonth) {
    const closed = await db
      .update(jobPostings)
      .set({ status: "closed", active: false, updatedAt: now })
      .where(
        and(
          eq(jobPostings.hrId, hr.id),
          eq(jobPostings.status, "active"),
          lt(jobPostings.createdAt, monthStart)
        )
      )
      .returning({ id: jobPostings.id });
    closedPrevious = closed.length;
  }

  const [importedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobPostings)
    .where(and(eq(jobPostings.hrId, hr.id), gte(jobPostings.createdAt, monthStart)));
  const monthImported = importedRow?.count ?? 0;
  const needed = Math.max(target - monthImported, 0);
  if (needed === 0) {
    return {
      done: true,
      inserted: 0,
      monthImported,
      monthTarget: target,
      monthLabel,
      closedPrevious,
      sources: [],
      errors: [],
    };
  }

  const existing = await db
    .select({
      title: jobPostings.title,
      organisationName: jobPostings.organisationName,
      location: jobPostings.location,
    })
    .from(jobPostings)
    .where(and(eq(jobPostings.hrId, hr.id), gte(jobPostings.createdAt, monthStart)));
  const existingKeys = new Set(existing.map((row) => jobDraftKey(row)));

  let fetched: MonthJobDraft[] = [];
  let sources: string[] = [];
  let errors: string[] = [];
  if (includeBoards) {
    const publicJobs = await fetchPublicMonthJobs(now);
    fetched = publicJobs.drafts;
    sources = publicJobs.sources;
    errors = publicJobs.errors;
  }

  const catalog = buildMonthJobCatalog(target, now);
  const toInsert = mergeMonthJobDrafts(fetched, catalog, existingKeys, Math.min(needed, maxInsert));
  const rows = draftsToRows(hr, toInsert);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += IMPORT_BATCH_SIZE) {
    const chunk = rows.slice(i, i + IMPORT_BATCH_SIZE);
    const saved = await db.insert(jobPostings).values(chunk).returning({ id: jobPostings.id });
    inserted += saved.length;
  }

  const nextTotal = monthImported + inserted;
  return {
    done: nextTotal >= target,
    inserted,
    monthImported: nextTotal,
    monthTarget: target,
    monthLabel,
    closedPrevious,
    sources,
    errors,
  };
}

/** Daily cron: close last month's platform listings, then fill this IST month to 2000. */
export async function fillCurrentMonthJobs(now = new Date()): Promise<MonthImportResult> {
  let includeBoards = true;
  let closedPrevious = 0;
  let last = await runMonthJobImport({
    now,
    maxInsert: 250,
    includeBoards,
    closePreviousMonth: true,
  });
  closedPrevious += last.closedPrevious;
  includeBoards = false;

  for (let i = 0; i < 9 && !last.done && last.inserted > 0; i += 1) {
    last = await runMonthJobImport({
      now,
      maxInsert: 250,
      includeBoards,
      closePreviousMonth: false,
    });
    closedPrevious += last.closedPrevious;
  }

  return { ...last, closedPrevious };
}

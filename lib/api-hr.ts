import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  auditLogs,
  companies,
  hrEmailVerifications,
  hrUsers,
  jobApplications,
  jobPostings,
  users,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/api-auth";
import {
  auditMetadataForSession,
  auditUserIdForSession,
  getClientIp,
  logAction,
} from "@/lib/audit";
import { formatApiError } from "@/lib/utils";
import {
  hrEmailSchema,
  hrOtpSchema,
  hrRegistrationSchema,
  hrJobSchema,
  changePasswordSchema,
  studentJobApplicationSchema,
  type HrJobInput,
} from "@/lib/validations";
import {
  sendApplicationRejectedEmail,
  sendApplicationShortlistedEmail,
  sendHrOtpEmail,
  sendHrWelcomeEmail,
  sendJobPostedEmail,
  sendNewApplicationEmail,
  trySendWelcomeEmail,
} from "@/lib/email";

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "proton.me",
  "protonmail.com",
  "icloud.com",
]);

function getDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function verifyCompanyBasic(companyName: string, email: string) {
  const domain = getDomain(email);
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, message: "Please use an official company email domain." };
  }
  if (!companyName || companyName.trim().length < 2) {
    return {
      ok: false,
      message: "Company details could not be verified. Please enter the registered company name.",
    };
  }
  const clean = companyName.trim();
  const website = `https://${domain}`;
  return {
    ok: true,
    website,
    domain,
    registrationDetails: { verificationMode: "basic_domain_check", inputName: clean },
  };
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POSTHrRequestOtp(request: Request) {
  const body = await request.json();
  const parsed = hrEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const domain = getDomain(email);
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return NextResponse.json({ error: "Use official company email." }, { status: 400 });
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hrEmailVerifications)
    .where(and(eq(hrEmailVerifications.email, email), gte(hrEmailVerifications.createdAt, tenMinutesAgo)));
  if ((recent?.count ?? 0) >= 5) {
    return NextResponse.json({ error: "Too many OTP requests. Try again later." }, { status: 429 });
  }

  const otp = generateOtp();
  await db.insert(hrEmailVerifications).values({
    email,
    otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });
  await sendHrOtpEmail({ email, otp });
  return NextResponse.json({ success: true, message: "OTP sent" });
}

export async function POSTHrVerifyOtp(request: Request) {
  const body = await request.json();
  const parsed = hrOtpSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  const [otpRow] = await db
    .select()
    .from(hrEmailVerifications)
    .where(eq(hrEmailVerifications.email, email))
    .orderBy(desc(hrEmailVerifications.createdAt))
    .limit(1);
  if (!otpRow) return NextResponse.json({ error: "OTP not found" }, { status: 404 });
  if (otpRow.verifiedAt) return NextResponse.json({ success: true, verified: true });
  if (otpRow.expiresAt < new Date()) return NextResponse.json({ error: "OTP expired" }, { status: 400 });
  if (otpRow.otp !== parsed.data.otp) {
    await db
      .update(hrEmailVerifications)
      .set({ attempts: (otpRow.attempts ?? 0) + 1 })
      .where(eq(hrEmailVerifications.id, otpRow.id));
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }
  await db.update(hrEmailVerifications).set({ verifiedAt: new Date() }).where(eq(hrEmailVerifications.id, otpRow.id));
  return NextResponse.json({ success: true, verified: true });
}

export async function POSTHrCompleteRegistration(request: Request) {
  const body = await request.json();
  const parsed = hrRegistrationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const [verifiedOtp] = await db
    .select()
    .from(hrEmailVerifications)
    .where(eq(hrEmailVerifications.email, email))
    .orderBy(desc(hrEmailVerifications.createdAt))
    .limit(1);
  if (!verifiedOtp || !verifiedOtp.verifiedAt) {
    return NextResponse.json({ error: "Email OTP verification required." }, { status: 400 });
  }

  const existingUser = await db.select({ id: hrUsers.id }).from(hrUsers).where(eq(hrUsers.email, email)).limit(1);
  if (existingUser.length) {
    return NextResponse.json({ error: "HR account already exists for this email." }, { status: 409 });
  }

  const companyCheck = verifyCompanyBasic(parsed.data.companyName, email);
  if (!companyCheck.ok) {
    return NextResponse.json({ error: companyCheck.message }, { status: 400 });
  }
  const verifiedCompany = companyCheck as {
    ok: true;
    website: string;
    domain: string;
    registrationDetails: Record<string, unknown>;
  };

  const [company] = await db
    .insert(companies)
    .values({
      companyName: parsed.data.companyName.trim(),
      domain: verifiedCompany.domain,
      website: verifiedCompany.website,
      registrationDetails: verifiedCompany.registrationDetails,
      verificationStatus: "verified",
    })
    .returning();

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const [hr] = await db
    .insert(hrUsers)
    .values({
      companyId: company.id,
      name: parsed.data.name.trim(),
      email,
      passwordHash: hashed,
      role: "hr",
      designation: parsed.data.designation || null,
      isActive: true,
    })
    .returning();

  await trySendWelcomeEmail("HR welcome", () =>
    sendHrWelcomeEmail({
      email,
      hrName: hr.name,
      companyName: company.companyName,
      password: parsed.data.password,
    })
  );
  await logAction({
    userId: undefined,
    role: "hr",
    action: "HR_REGISTERED",
    entity: "HrUser",
    entityId: hr.id,
    metadata: {
      hrId: hr.id,
      companyId: company.id,
      companyName: company.companyName,
    },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}

export async function GETHrDashboard() {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;

  const hrId = session!.user.id;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [activeJobs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobPostings)
    .where(and(eq(jobPostings.hrId, hrId), eq(jobPostings.status, "active")));
  const [closedJobs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobPostings)
    .where(and(eq(jobPostings.hrId, hrId), eq(jobPostings.status, "closed")));
  const [totalApps] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobPostings.hrId, hrId));
  const [monthlyApps] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(and(eq(jobPostings.hrId, hrId), gte(jobApplications.appliedAt, monthStart)));

  const recentApplications = await db
    .select({
      id: jobApplications.id,
      applicantName: jobApplications.fullName,
      status: jobApplications.status,
      appliedAt: jobApplications.appliedAt,
      jobTitle: jobPostings.title,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobPostings.hrId, hrId))
    .orderBy(desc(jobApplications.appliedAt))
    .limit(10);

  return NextResponse.json({
    activeJobs: activeJobs?.count ?? 0,
    closedJobs: closedJobs?.count ?? 0,
    totalApplications: totalApps?.count ?? 0,
    applicationsThisMonth: monthlyApps?.count ?? 0,
    recentApplications,
  });
}

export async function GETHrLiveJobs() {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;
  const jobs = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.hrId, session!.user.id), eq(jobPostings.status, "active")))
    .orderBy(desc(jobPostings.createdAt));
  return NextResponse.json(jobs);
}

async function getHrOwnedJob(jobId: string, hrId: string) {
  const [job] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, jobId), eq(jobPostings.hrId, hrId)))
    .limit(1);
  return job ?? null;
}

function parseHrJobDates(data: HrJobInput) {
  const deadline = new Date(data.applicationDeadline);
  if (Number.isNaN(deadline.getTime())) {
    return { error: "Invalid last date to apply." } as const;
  }
  return { deadline, lastDate: deadline } as const;
}

function hrJobValuesFromParsed(data: HrJobInput, deadline: Date, lastDate: Date | null) {
  return {
    title: data.title.trim(),
    organisationName: data.organisationName.trim(),
    location: data.location?.trim() || null,
    employmentType: data.employmentType,
    stipend: data.stipend?.trim() || null,
    salary: data.salary?.trim() || null,
    ctc: data.ctc?.trim() || null,
    experienceRequired: data.experienceRequired?.trim() || null,
    description: data.description.trim(),
    responsibilities: data.responsibilities?.trim() || null,
    requiredSkills: data.requiredSkills?.trim() || null,
    eligibilityCriteria: data.eligibilityCriteria?.trim() || null,
    lastDateToApply: deadline,
    applicationDeadline: deadline,
    openings: data.openings,
    status: data.active === false ? ("closed" as const) : ("active" as const),
    active: data.active !== false,
    updatedAt: new Date(),
  };
}

export async function GETHrJobById(_request: Request, id: string) {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;

  const job = await getHrOwnedJob(id, session!.user.id);
  if (!job) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}

export async function PATCHHrJob(request: Request, id: string) {
  try {
    const { error, session } = await requireAuth(["hr"]);
    if (error) return error;

    const existing = await getHrOwnedJob(id, session!.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = hrJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatApiError(parsed.error.flatten(), "Invalid job data") },
        { status: 400 }
      );
    }

    const dates = parseHrJobDates(parsed.data);
    if ("error" in dates && dates.error) {
      return NextResponse.json({ error: dates.error }, { status: 400 });
    }
    const { deadline, lastDate } = dates;

    const [job] = await db
      .update(jobPostings)
      .set(hrJobValuesFromParsed(parsed.data, deadline, lastDate))
      .where(eq(jobPostings.id, id))
      .returning();

    try {
      await logAction({
        userId: auditUserIdForSession(session!.user),
        role: "hr",
        action: "HR_JOB_UPDATED",
        entity: "JobPosting",
        entityId: job.id,
        metadata: auditMetadataForSession(session!.user, { title: job.title }),
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error("[PATCHHrJob] Audit log failed:", auditErr);
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("[PATCHHrJob]", err);
    const msg = err instanceof Error ? err.message : "Failed to update job posting";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETEHrJob(request: Request, id: string) {
  try {
    const { error, session } = await requireAuth(["hr"]);
    if (error) return error;

    const existing = await getHrOwnedJob(id, session!.user.id);
    if (!existing) {
      return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
    }

    if (existing.status !== "active") {
      return NextResponse.json({ error: "Job is already closed" }, { status: 400 });
    }

    const [job] = await db
      .update(jobPostings)
      .set({ status: "closed", active: false, updatedAt: new Date() })
      .where(eq(jobPostings.id, id))
      .returning();

    try {
      await logAction({
        userId: auditUserIdForSession(session!.user),
        role: "hr",
        action: "HR_JOB_DELETED",
        entity: "JobPosting",
        entityId: job.id,
        metadata: auditMetadataForSession(session!.user, { title: job.title }),
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error("[DELETEHrJob] Audit log failed:", auditErr);
    }

    return NextResponse.json({ success: true, job });
  } catch (err) {
    console.error("[DELETEHrJob]", err);
    const msg = err instanceof Error ? err.message : "Failed to delete job posting";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POSTHrJob(request: Request) {
  try {
    const { error, session } = await requireAuth(["hr"]);
    if (error) return error;

    const body = await request.json();
    const parsed = hrJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatApiError(parsed.error.flatten(), "Invalid job data") },
        { status: 400 }
      );
    }

    const deadline = new Date(parsed.data.applicationDeadline);
    if (Number.isNaN(deadline.getTime())) {
      return NextResponse.json(
        { error: "Invalid application closing date/time." },
        { status: 400 }
      );
    }

    const [hr] = await db
      .select()
      .from(hrUsers)
      .where(eq(hrUsers.id, session!.user.id))
      .limit(1);
    if (!hr) {
      return NextResponse.json({ error: "HR account not found" }, { status: 404 });
    }

    const [job] = await db
      .insert(jobPostings)
      .values({
        hrId: hr.id,
        companyId: hr.companyId,
        title: parsed.data.title.trim(),
        organisationName: parsed.data.organisationName.trim(),
        location: parsed.data.location?.trim() || null,
        employmentType: parsed.data.employmentType,
        stipend: parsed.data.stipend?.trim() || null,
        salary: parsed.data.salary?.trim() || null,
        ctc: parsed.data.ctc?.trim() || null,
        experienceRequired: parsed.data.experienceRequired?.trim() || null,
        description: parsed.data.description.trim(),
        responsibilities: parsed.data.responsibilities?.trim() || null,
        requiredSkills: parsed.data.requiredSkills?.trim() || null,
        eligibilityCriteria: parsed.data.eligibilityCriteria?.trim() || null,
        lastDateToApply: deadline,
        applicationDeadline: deadline,
        openings: parsed.data.openings,
        status: parsed.data.active === false ? "closed" : "active",
        active: parsed.data.active !== false,
      })
      .returning();

    try {
      await logAction({
        userId: auditUserIdForSession(session!.user),
        role: "hr",
        action: "HR_JOB_CREATED",
        entity: "JobPosting",
        entityId: job.id,
        metadata: auditMetadataForSession(session!.user, { title: job.title }),
        ipAddress: getClientIp(request),
      });
    } catch (auditErr) {
      console.error("[POSTHrJob] Audit log failed:", auditErr);
    }

    try {
      await sendJobPostedEmail({
        email: hr.email,
        hrName: hr.name,
        jobTitle: job.title,
        companyName: job.organisationName,
      });
    } catch (e) {
      console.error("[HR] job posted email failed", e);
    }

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    console.error("[POSTHrJob]", err);
    const msg = err instanceof Error ? err.message : "Failed to create job posting";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GETHrPreviousJobs() {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;

  await db
    .update(jobPostings)
    .set({ status: "closed", active: false, updatedAt: new Date() })
    .where(and(eq(jobPostings.hrId, session!.user.id), lte(jobPostings.applicationDeadline, new Date()), eq(jobPostings.status, "active")));

  const jobs = await db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      createdAt: jobPostings.createdAt,
      closedAt: jobPostings.updatedAt,
      totalApplications: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id}
      )`,
    })
    .from(jobPostings)
    .where(and(eq(jobPostings.hrId, session!.user.id), inArray(jobPostings.status, ["closed", "archived"])))
    .orderBy(desc(jobPostings.updatedAt));
  return NextResponse.json(jobs);
}

export async function GETHrApplications(request: Request) {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const jobId = searchParams.get("jobId");

  const conditions = [eq(jobPostings.hrId, session!.user.id)];
  if (status && ["pending", "shortlisted", "rejected"].includes(status)) {
    conditions.push(eq(jobApplications.status, status as "pending" | "shortlisted" | "rejected"));
  }
  if (jobId) conditions.push(eq(jobApplications.jobId, jobId));

  const rows = await db
    .select({
      id: jobApplications.id,
      applicantName: jobApplications.fullName,
      email: jobApplications.email,
      phone: jobApplications.phone,
      collegeName: jobApplications.collegeName,
      jobTitle: jobPostings.title,
      status: jobApplications.status,
      appliedAt: jobApplications.appliedAt,
      resumeUrl: jobApplications.resumeUrl,
      jobId: jobApplications.jobId,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(and(...conditions))
    .orderBy(desc(jobApplications.appliedAt));
  return NextResponse.json(rows);
}

export async function PATCHHrApplicationStatus(request: Request) {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;
  const body = await request.json();
  const id = body.id as string;
  const status = body.status as "pending" | "shortlisted" | "rejected";
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const [app] = await db
    .select({ id: jobApplications.id, jobId: jobApplications.jobId })
    .from(jobApplications)
    .where(eq(jobApplications.id, id))
    .limit(1);
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const [job] = await db.select({ hrId: jobPostings.hrId }).from(jobPostings).where(eq(jobPostings.id, app.jobId)).limit(1);
  if (!job || job.hrId !== session!.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [updated] = await db
    .update(jobApplications)
    .set({ status, updatedAt: new Date() })
    .where(eq(jobApplications.id, id))
    .returning({
      id: jobApplications.id,
      email: jobApplications.email,
      fullName: jobApplications.fullName,
      jobId: jobApplications.jobId,
    });
  if (!updated) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const [jobTitle] = await db
    .select({ title: jobPostings.title })
    .from(jobPostings)
    .where(eq(jobPostings.id, app.jobId))
    .limit(1);
  try {
    if (status === "shortlisted") {
      await sendApplicationShortlistedEmail({
        email: updated.email,
        applicantName: updated.fullName,
        jobTitle: jobTitle?.title || "Job",
      });
    } else if (status === "rejected") {
      await sendApplicationRejectedEmail({
        email: updated.email,
        applicantName: updated.fullName,
        jobTitle: jobTitle?.title || "Job",
      });
    }
  } catch (e) {
    console.error("[HR] application status email failed", e);
  }
  await logAction({
    userId: auditUserIdForSession(session!.user),
    role: "hr",
    action: "HR_APPLICATION_STATUS_UPDATED",
    entity: "JobApplication",
    entityId: id,
    metadata: auditMetadataForSession(session!.user, { status }),
    ipAddress: getClientIp(request),
  });
  return NextResponse.json({ success: true });
}

export async function GETStudentJobPortal(request: Request) {
  const { error } = await requireAuth(["student"]);
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  await db
    .update(jobPostings)
    .set({ status: "closed", active: false, updatedAt: new Date() })
    .where(and(lte(jobPostings.applicationDeadline, new Date()), eq(jobPostings.status, "active")));

  const rows = await db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      organisationName: jobPostings.organisationName,
      location: jobPostings.location,
      experienceRequired: jobPostings.experienceRequired,
      salary: jobPostings.salary,
      ctc: jobPostings.ctc,
      lastDateToApply: jobPostings.lastDateToApply,
      applicationDeadline: jobPostings.applicationDeadline,
      createdAt: jobPostings.createdAt,
    })
    .from(jobPostings)
    .where(
      and(
        eq(jobPostings.status, "active"),
        eq(jobPostings.active, true),
        q
          ? or(
              sql`${jobPostings.title} ilike ${`%${q}%`}`,
              sql`${jobPostings.organisationName} ilike ${`%${q}%`}`
            )
          : undefined
      )
    )
    .orderBy(desc(jobPostings.createdAt));
  return NextResponse.json(rows);
}

export async function GETStudentJobApplications(request: Request) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;

  const rows = await db
    .select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      jobTitle: jobPostings.title,
      organisationName: jobPostings.organisationName,
      location: jobPostings.location,
      employmentType: jobPostings.employmentType,
      status: jobApplications.status,
      appliedAt: jobApplications.appliedAt,
      updatedAt: jobApplications.updatedAt,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobApplications.studentId, session!.user.id))
    .orderBy(desc(jobApplications.appliedAt));

  return NextResponse.json(rows);
}

export async function POSTStudentJobApplication(request: Request) {
  const { error, session } = await requireAuth(["student"]);
  if (error) return error;
  const body = await request.json();
  const parsed = studentJobApplicationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [job] = await db
    .select({ id: jobPostings.id, status: jobPostings.status, applicationDeadline: jobPostings.applicationDeadline })
    .from(jobPostings)
    .where(eq(jobPostings.id, parsed.data.jobId))
    .limit(1);
  if (!job || job.status !== "active" || job.applicationDeadline < new Date()) {
    return NextResponse.json({ error: "Job is no longer accepting applications." }, { status: 400 });
  }
  const [exists] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(and(eq(jobApplications.jobId, parsed.data.jobId), eq(jobApplications.studentId, session!.user.id)))
    .limit(1);
  if (exists) return NextResponse.json({ error: "You have already applied to this job." }, { status: 409 });

  const [application] = await db
    .insert(jobApplications)
    .values({
      jobId: parsed.data.jobId,
      studentId: session!.user.id,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      collegeName: parsed.data.collegeName,
      yearOfStudy: parsed.data.yearOfStudy,
      passedOutYear: parsed.data.passedOutYear,
      resumeUrl: parsed.data.resumeUrl,
      linkedinUrl: parsed.data.linkedinUrl || null,
      portfolioUrl: parsed.data.portfolioUrl || null,
      status: "pending",
    })
    .returning();

  await logAction({
    userId: session!.user.id,
    role: session!.user.role,
    action: "STUDENT_APPLIED_TO_JOB",
    entity: "JobApplication",
    entityId: application.id,
    metadata: { jobId: parsed.data.jobId },
    ipAddress: getClientIp(request),
  });
  try {
    const [hr] = await db
      .select({ email: hrUsers.email, name: hrUsers.name })
      .from(hrUsers)
      .innerJoin(jobPostings, eq(jobPostings.hrId, hrUsers.id))
      .where(eq(jobPostings.id, parsed.data.jobId))
      .limit(1);
    const [jobTitle] = await db
      .select({ title: jobPostings.title })
      .from(jobPostings)
      .where(eq(jobPostings.id, parsed.data.jobId))
      .limit(1);
    if (hr) {
      await sendNewApplicationEmail({
        email: hr.email,
        hrName: hr.name,
        jobTitle: jobTitle?.title || "Job",
        applicantName: parsed.data.fullName,
      });
    }
  } catch (e) {
    console.error("[HR] new application email failed", e);
  }
  return NextResponse.json({ success: true });
}

export async function GETSuperAdminHrs(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") || "10"), 1), 50);
  const q = searchParams.get("q")?.trim();
  const offset = (page - 1) * pageSize;
  const conditions = q
    ? or(
        sql`${hrUsers.name} ilike ${`%${q}%`}`,
        sql`${hrUsers.email} ilike ${`%${q}%`}`,
        sql`${companies.companyName} ilike ${`%${q}%`}`
      )
    : undefined;

  const rows = await db
    .select({
      id: hrUsers.id,
      hrName: hrUsers.name,
      email: hrUsers.email,
      designation: hrUsers.designation,
      isActive: hrUsers.isActive,
      registrationDate: hrUsers.createdAt,
      companyName: companies.companyName,
      verificationStatus: companies.verificationStatus,
      totalActiveJobs: sql<number>`(
        select count(*)::int from ${jobPostings} jp where jp.hr_id = ${hrUsers.id} and jp.status = 'active'
      )`,
      totalJobsPosted: sql<number>`(
        select count(*)::int from ${jobPostings} jp where jp.hr_id = ${hrUsers.id}
      )`,
      totalApplicationsReceived: sql<number>`(
        select count(*)::int
        from ${jobApplications} ja
        join ${jobPostings} jp on jp.id = ja.job_id
        where jp.hr_id = ${hrUsers.id}
      )`,
    })
    .from(hrUsers)
    .innerJoin(companies, eq(hrUsers.companyId, companies.id))
    .where(conditions)
    .orderBy(desc(hrUsers.createdAt));
  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hrUsers)
    .innerJoin(companies, eq(hrUsers.companyId, companies.id))
    .where(conditions);

  const paginatedRows = rows.slice(offset, offset + pageSize);
  return NextResponse.json({
    items: paginatedRows,
    page,
    pageSize,
    total: totalRows[0]?.count ?? 0,
    totalPages: Math.max(Math.ceil((totalRows[0]?.count ?? 0) / pageSize), 1),
  });
}

export async function PATCHSuperAdminHrStatus(request: Request) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;
  const body = await request.json();
  const id = body.id as string | undefined;
  const isActive = body.isActive as boolean | undefined;
  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id and isActive are required." }, { status: 400 });
  }

  const [updated] = await db
    .update(hrUsers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(hrUsers.id, id))
    .returning({ id: hrUsers.id, isActive: hrUsers.isActive });
  if (!updated) return NextResponse.json({ error: "HR account not found." }, { status: 404 });

  await logAction({
    userId: undefined,
    role: "super_admin",
    action: isActive ? "SUPER_ADMIN_ENABLED_HR" : "SUPER_ADMIN_DISABLED_HR",
    entity: "HrUser",
    entityId: id,
    metadata: { isActive },
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ success: true, ...updated });
}

export async function GETSuperAdminJobPostings() {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  await db
    .update(jobPostings)
    .set({ status: "closed", active: false, updatedAt: new Date() })
    .where(and(lte(jobPostings.applicationDeadline, new Date()), eq(jobPostings.status, "active")));

  const rows = await db
    .select({
      id: jobPostings.id,
      jobTitle: jobPostings.title,
      companyName: companies.companyName,
      hrName: hrUsers.name,
      employmentType: jobPostings.employmentType,
      applicationsCount: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id}
      )`,
      postedDate: jobPostings.createdAt,
      lastDate: jobPostings.lastDateToApply,
      status: jobPostings.status,
    })
    .from(jobPostings)
    .innerJoin(hrUsers, eq(jobPostings.hrId, hrUsers.id))
    .innerJoin(companies, eq(jobPostings.companyId, companies.id))
    .orderBy(desc(jobPostings.createdAt));

  return NextResponse.json(rows);
}

export async function GETSuperAdminJobPostingDetail(id: string) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const [detail] = await db
    .select({
      id: jobPostings.id,
      jobTitle: jobPostings.title,
      description: jobPostings.description,
      responsibilities: jobPostings.responsibilities,
      experience: jobPostings.experienceRequired,
      salary: jobPostings.salary,
      stipend: jobPostings.stipend,
      ctc: jobPostings.ctc,
      lastDateToApply: jobPostings.lastDateToApply,
      applicationDeadline: jobPostings.applicationDeadline,
      status: jobPostings.status,
      employmentType: jobPostings.employmentType,
      postedDate: jobPostings.createdAt,
      companyName: companies.companyName,
      companyWebsite: companies.website,
      companyDomain: companies.domain,
      companyVerificationStatus: companies.verificationStatus,
      companyEmail: hrUsers.email,
      organizationLogo: hrUsers.logoUrl,
      hrName: hrUsers.name,
      hrEmail: hrUsers.email,
      hrDesignation: hrUsers.designation,
      totalApplications: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id}
      )`,
      pendingApplications: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id} and ja.status = 'pending'
      )`,
      shortlistedApplications: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id} and ja.status = 'shortlisted'
      )`,
      rejectedApplications: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id} and ja.status = 'rejected'
      )`,
    })
    .from(jobPostings)
    .innerJoin(hrUsers, eq(jobPostings.hrId, hrUsers.id))
    .innerJoin(companies, eq(jobPostings.companyId, companies.id))
    .where(eq(jobPostings.id, id))
    .limit(1);

  if (!detail) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function GETHrSettings() {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;

  const [row] = await db
    .select({
      hrId: hrUsers.id,
      name: hrUsers.name,
      email: hrUsers.email,
      designation: hrUsers.designation,
      logoUrl: hrUsers.logoUrl,
      isActive: hrUsers.isActive,
      companyId: companies.id,
      companyName: companies.companyName,
      companyDomain: companies.domain,
      companyWebsite: companies.website,
      companyVerificationStatus: companies.verificationStatus,
      companyRegistrationDetails: companies.registrationDetails,
    })
    .from(hrUsers)
    .innerJoin(companies, eq(hrUsers.companyId, companies.id))
    .where(eq(hrUsers.id, session!.user.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "HR profile not found." }, { status: 404 });
  }
  return NextResponse.json(row);
}

export async function PATCHHrSettings(request: Request) {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;
  const body = await request.json();

  const nextName = typeof body.name === "string" ? body.name.trim() : undefined;
  const nextDesignation = typeof body.designation === "string" ? body.designation.trim() : undefined;
  const nextLogoUrl = typeof body.logoUrl === "string" || body.logoUrl === null ? body.logoUrl : undefined;
  const nextCompanyName = typeof body.companyName === "string" ? body.companyName.trim() : undefined;
  const nextWebsite = typeof body.companyWebsite === "string" ? body.companyWebsite.trim() : undefined;

  if (nextName !== undefined && nextName.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
  }
  if (nextCompanyName !== undefined && nextCompanyName.length < 2) {
    return NextResponse.json({ error: "Company name must be at least 2 characters." }, { status: 400 });
  }
  if (nextWebsite && !/^https?:\/\//i.test(nextWebsite)) {
    return NextResponse.json({ error: "Company website must start with http:// or https://." }, { status: 400 });
  }

  const [hr] = await db
    .select({ companyId: hrUsers.companyId })
    .from(hrUsers)
    .where(eq(hrUsers.id, session!.user.id))
    .limit(1);
  if (!hr) return NextResponse.json({ error: "HR account not found." }, { status: 404 });

  if (nextName !== undefined || nextDesignation !== undefined || nextLogoUrl !== undefined) {
    await db
      .update(hrUsers)
      .set({
        name: nextName,
        designation: nextDesignation,
        logoUrl: nextLogoUrl,
        updatedAt: new Date(),
      })
      .where(eq(hrUsers.id, session!.user.id));
  }

  if (nextCompanyName !== undefined || nextWebsite !== undefined) {
    await db
      .update(companies)
      .set({
        companyName: nextCompanyName,
        website: nextWebsite,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, hr.companyId));
  }

  await logAction({
    userId: auditUserIdForSession(session!.user),
    role: "hr",
    action: "HR_SETTINGS_UPDATED",
    entity: "HrUser",
    entityId: session!.user.id,
    metadata: auditMetadataForSession(session!.user, {
      profileUpdated: nextName !== undefined || nextDesignation !== undefined || nextLogoUrl !== undefined,
      companyUpdated: nextCompanyName !== undefined || nextWebsite !== undefined,
    }),
    ipAddress: getClientIp(request),
  });

  return GETHrSettings();
}

export async function PATCHHrPassword(request: Request) {
  const { error, session } = await requireAuth(["hr"]);
  if (error) return error;
  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [hr] = await db
    .select({ id: hrUsers.id, passwordHash: hrUsers.passwordHash })
    .from(hrUsers)
    .where(eq(hrUsers.id, session!.user.id))
    .limit(1);
  if (!hr) return NextResponse.json({ error: "HR account not found." }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, hr.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(hrUsers).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(hrUsers.id, session!.user.id));
  await logAction({
    userId: auditUserIdForSession(session!.user),
    role: "hr",
    action: "HR_PASSWORD_CHANGED",
    entity: "HrUser",
    entityId: session!.user.id,
    metadata: auditMetadataForSession(session!.user, {}),
    ipAddress: getClientIp(request),
  });
  return NextResponse.json({ success: true });
}

export async function GETSuperAdminHrDetail(id: string) {
  const { error } = await requireAuth(["super_admin"]);
  if (error) return error;

  const [row] = await db
    .select({
      id: hrUsers.id,
      name: hrUsers.name,
      email: hrUsers.email,
      designation: hrUsers.designation,
      logoUrl: hrUsers.logoUrl,
      isActive: hrUsers.isActive,
      accountCreatedDate: hrUsers.createdAt,
      companyId: companies.id,
      companyName: companies.companyName,
      companyEmail: hrUsers.email,
      companyDomain: companies.domain,
      companyWebsite: companies.website,
      companyVerificationStatus: companies.verificationStatus,
      registrationDetails: companies.registrationDetails,
      totalJobsPosted: sql<number>`(
        select count(*)::int from ${jobPostings} jp where jp.hr_id = ${hrUsers.id}
      )`,
      activeJobs: sql<number>`(
        select count(*)::int from ${jobPostings} jp where jp.hr_id = ${hrUsers.id} and jp.status = 'active'
      )`,
      closedJobs: sql<number>`(
        select count(*)::int from ${jobPostings} jp where jp.hr_id = ${hrUsers.id} and jp.status = 'closed'
      )`,
      totalApplications: sql<number>`(
        select count(*)::int
        from ${jobApplications} ja
        join ${jobPostings} jp on jp.id = ja.job_id
        where jp.hr_id = ${hrUsers.id}
      )`,
      pendingApplications: sql<number>`(
        select count(*)::int
        from ${jobApplications} ja
        join ${jobPostings} jp on jp.id = ja.job_id
        where jp.hr_id = ${hrUsers.id} and ja.status = 'pending'
      )`,
      shortlistedApplications: sql<number>`(
        select count(*)::int
        from ${jobApplications} ja
        join ${jobPostings} jp on jp.id = ja.job_id
        where jp.hr_id = ${hrUsers.id} and ja.status = 'shortlisted'
      )`,
      rejectedApplications: sql<number>`(
        select count(*)::int
        from ${jobApplications} ja
        join ${jobPostings} jp on jp.id = ja.job_id
        where jp.hr_id = ${hrUsers.id} and ja.status = 'rejected'
      )`,
    })
    .from(hrUsers)
    .innerJoin(companies, eq(hrUsers.companyId, companies.id))
    .where(eq(hrUsers.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "HR not found." }, { status: 404 });

  const jobs = await db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      employmentType: jobPostings.employmentType,
      status: jobPostings.status,
      postedDate: jobPostings.createdAt,
      lastDate: jobPostings.lastDateToApply,
      totalApplications: sql<number>`(
        select count(*)::int from ${jobApplications} ja where ja.job_id = ${jobPostings.id}
      )`,
    })
    .from(jobPostings)
    .where(eq(jobPostings.hrId, id))
    .orderBy(desc(jobPostings.createdAt));

  const recentApplications = await db
    .select({
      id: jobApplications.id,
      studentName: jobApplications.fullName,
      collegeName: jobApplications.collegeName,
      appliedJob: jobPostings.title,
      appliedDate: jobApplications.appliedAt,
      status: jobApplications.status,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobPostings.hrId, id))
    .orderBy(desc(jobApplications.appliedAt))
    .limit(20);

  const timeline = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(and(eq(auditLogs.role, "hr"), eq(auditLogs.userId, id)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(25);

  const jobsByMonth = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${jobPostings.createdAt}), 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(jobPostings)
    .where(eq(jobPostings.hrId, id))
    .groupBy(sql`date_trunc('month', ${jobPostings.createdAt})`)
    .orderBy(sql`date_trunc('month', ${jobPostings.createdAt})`);

  const applicationsByMonth = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${jobApplications.appliedAt}), 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
    })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobPostings.hrId, id))
    .groupBy(sql`date_trunc('month', ${jobApplications.appliedAt})`)
    .orderBy(sql`date_trunc('month', ${jobApplications.appliedAt})`);

  const topAppliedJobs = await db
    .select({
      jobId: jobPostings.id,
      jobTitle: jobPostings.title,
      applicationsCount: sql<number>`count(${jobApplications.id})::int`,
    })
    .from(jobPostings)
    .leftJoin(jobApplications, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobPostings.hrId, id))
    .groupBy(jobPostings.id, jobPostings.title)
    .orderBy(desc(sql`count(${jobApplications.id})`))
    .limit(5);

  const [lastJobPosted] = await db
    .select({ createdAt: jobPostings.createdAt })
    .from(jobPostings)
    .where(eq(jobPostings.hrId, id))
    .orderBy(desc(jobPostings.createdAt))
    .limit(1);

  const [mostRecentApplication] = await db
    .select({ appliedAt: jobApplications.appliedAt })
    .from(jobApplications)
    .innerJoin(jobPostings, eq(jobApplications.jobId, jobPostings.id))
    .where(eq(jobPostings.hrId, id))
    .orderBy(desc(jobApplications.appliedAt))
    .limit(1);

  const [lastLoginLog] = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.role, "hr"), eq(auditLogs.userId, id), eq(auditLogs.action, "HR_LOGIN")))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);

  return NextResponse.json({
    profile: {
      id: row.id,
      name: row.name,
      designation: row.designation,
      email: row.email,
      isActive: row.isActive,
      lastLoginDate: lastLoginLog?.createdAt ?? null,
      accountCreatedDate: row.accountCreatedDate,
    },
    company: {
      name: row.companyName,
      email: row.companyEmail,
      website: row.companyWebsite,
      logoUrl: row.logoUrl,
      verificationStatus: row.companyVerificationStatus,
      registrationDate: row.accountCreatedDate,
    },
    recruitment: {
      totalJobsPosted: row.totalJobsPosted,
      activeJobs: row.activeJobs,
      closedJobs: row.closedJobs,
      totalApplicationsReceived: row.totalApplications,
      pendingApplications: row.pendingApplications,
      shortlistedApplications: row.shortlistedApplications,
      rejectedApplications: row.rejectedApplications,
    },
    activityMetrics: {
      lastLoginDate: lastLoginLog?.createdAt ?? null,
      lastJobPostedDate: lastJobPosted?.createdAt ?? null,
      mostRecentApplicationDate: mostRecentApplication?.appliedAt ?? null,
    },
    jobs,
    recentApplications,
    timeline,
    analytics: {
      jobsByMonth,
      applicationsByMonth,
      topAppliedJobs,
    },
  });
}


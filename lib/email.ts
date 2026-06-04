import { appName, deliverEmail } from "@/lib/mail";
import { getAppUrl } from "@/lib/app-url";

const appUrl = getAppUrl();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmail(payload: { to: string; subject: string; html: string }) {
  const result = await deliverEmail(payload);
  if (!result.ok) {
    throw new Error(result.error ?? "Failed to send email");
  }
  return result;
}

export type WelcomeEmailResult = {
  sent: boolean;
  mode?: string;
  error?: string;
};

type CredentialField = { label: string; value: string };

async function sendMemberCredentialsEmail({
  email,
  name,
  roleLabel,
  password,
  loginPath,
  introHtml,
  extraFields = [],
}: {
  email: string;
  name: string;
  roleLabel: string;
  password: string;
  loginPath: string;
  introHtml: string;
  extraFields?: CredentialField[];
}) {
  const extras = extraFields
    .map((f) => `<li><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</li>`)
    .join("");

  const safeEmail = email.trim().toLowerCase();

  return sendEmail({
    to: safeEmail,
    subject: `Welcome to ${appName} — ${roleLabel} Account`,
    html: `
      <h2>Welcome, ${escapeHtml(name)}!</h2>
      ${introHtml}
      <p>Your login credentials:</p>
      <ul>
        ${extras}
        <li><strong>Email:</strong> ${escapeHtml(safeEmail)}</li>
        <li><strong>Password:</strong> ${escapeHtml(password)}</li>
      </ul>
      <p><a href="${appUrl}${loginPath}">Login here</a></p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">Please change your password after first login if your organisation requires it.</p>
      <p style="color:#64748b;font-size:12px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

/** Send welcome email; never fails the API — returns status for the UI. */
export async function trySendWelcomeEmail(
  label: string,
  fn: () => Promise<unknown>
): Promise<WelcomeEmailResult> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "ok" in result) {
      const r = result as { ok: boolean; mode?: string; error?: string };
      if (!r.ok) {
        console.error(`[email] ${label} not sent:`, r.error);
        return { sent: false, mode: r.mode, error: r.error };
      }
      return { sent: true, mode: r.mode };
    }
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${label} failed:`, msg);
    return { sent: false, error: msg };
  }
}

export async function sendStudentWelcomeEmail({
  email,
  studentName,
  lmsId,
  password,
  courseName,
}: {
  email: string;
  studentName: string;
  lmsId: string;
  password: string;
  courseName: string;
}) {
  return sendMemberCredentialsEmail({
    email,
    name: studentName,
    roleLabel: "Student",
    password,
    loginPath: "/login",
    introHtml: `<p>You have been enrolled in <strong>${escapeHtml(courseName)}</strong>.</p>`,
    extraFields: [{ label: "LMS ID", value: lmsId }],
  });
}

export async function sendOrgAdminWelcomeEmail({
  email,
  adminName,
  orgName,
  password,
}: {
  email: string;
  adminName: string;
  orgName: string;
  password: string;
}) {
  return sendMemberCredentialsEmail({
    email,
    name: adminName,
    roleLabel: "Organisation Admin",
    password,
    loginPath: "/login",
    introHtml: `<p>Your organisation <strong>${escapeHtml(orgName)}</strong> has been set up on ${appName}.</p>`,
  });
}

export async function sendManagerWelcomeEmail({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) {
  return sendMemberCredentialsEmail({
    email,
    name,
    roleLabel: "Manager",
    password,
    loginPath: "/login",
    introHtml: `<p>Your <strong>Manager</strong> account has been created.</p>`,
  });
}

export async function sendMentorWelcomeEmail({
  email,
  name,
  password,
}: {
  email: string;
  name: string;
  password: string;
}) {
  return sendMemberCredentialsEmail({
    email,
    name,
    roleLabel: "Mentor",
    password,
    loginPath: "/login",
    introHtml: `<p>Your <strong>Mentor</strong> account has been created. You can view assigned live classes after login.</p>`,
  });
}

export async function sendHrWelcomeEmail({
  email,
  hrName,
  companyName,
  password,
}: {
  email: string;
  hrName: string;
  companyName: string;
  password: string;
}) {
  return sendMemberCredentialsEmail({
    email,
    name: hrName,
    roleLabel: "HR",
    password,
    loginPath: "/hr/login",
    introHtml: `<p>Your HR account for <strong>${escapeHtml(companyName)}</strong> is ready.</p>`,
  });
}

export async function sendMentorLiveClassEmail({
  email,
  mentorName,
  title,
  courseName,
  batchName,
  scheduledAt,
  meetingLink,
}: {
  email: string;
  mentorName: string;
  title: string;
  courseName: string;
  batchName?: string;
  scheduledAt: string;
  meetingLink?: string;
}) {
  await sendEmail({
    to: email,
    subject: `New Live Class Assigned: ${title}`,
    html: `
      <h2>Hello ${mentorName},</h2>
      <p>A new live class has been assigned to you.</p>
      <ul>
        <li><strong>Title:</strong> ${title}</li>
        <li><strong>Course:</strong> ${courseName}</li>
        ${batchName ? `<li><strong>Batch:</strong> ${batchName}</li>` : ""}
        <li><strong>Scheduled:</strong> ${scheduledAt}</li>
        ${meetingLink ? `<li><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></li>` : ""}
      </ul>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

export async function sendHrOtpEmail({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  await sendEmail({
    to: email,
    subject: `Your ${appName} HR verification OTP`,
    html: `
      <h2>HR Email Verification</h2>
      <p>Your OTP is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px">${otp}</p>
      <p>This code expires in 10 minutes.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

export async function sendJobPostedEmail({
  email,
  hrName,
  jobTitle,
  companyName,
}: {
  email: string;
  hrName: string;
  jobTitle: string;
  companyName: string;
}) {
  await sendEmail({
    to: email,
    subject: "Job Posted Successfully",
    html: `
      <h2>Hello ${hrName},</h2>
      <p>Your job <strong>${jobTitle}</strong> for <strong>${companyName}</strong> is now live.</p>
      <p><a href="${appUrl}/hr/jobs/live">View live jobs</a></p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

export async function sendNewApplicationEmail({
  email,
  hrName,
  jobTitle,
  applicantName,
}: {
  email: string;
  hrName: string;
  jobTitle: string;
  applicantName: string;
}) {
  await sendEmail({
    to: email,
    subject: "New Application Received",
    html: `
      <h2>Hello ${hrName},</h2>
      <p><strong>${applicantName}</strong> applied for <strong>${jobTitle}</strong>.</p>
      <p><a href="${appUrl}/hr/applications">Open applications</a></p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

export async function sendApplicationShortlistedEmail({
  email,
  applicantName,
  jobTitle,
}: {
  email: string;
  applicantName: string;
  jobTitle: string;
}) {
  await sendEmail({
    to: email,
    subject: "Application Shortlisted",
    html: `
      <h2>Hello ${applicantName},</h2>
      <p>Your application for <strong>${jobTitle}</strong> has been shortlisted.</p>
      <p>We will contact you with next steps.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

export async function sendApplicationRejectedEmail({
  email,
  applicantName,
  jobTitle,
}: {
  email: string;
  applicantName: string;
  jobTitle: string;
}) {
  await sendEmail({
    to: email,
    subject: "Application Update",
    html: `
      <h2>Hello ${applicantName},</h2>
      <p>Thank you for applying to <strong>${jobTitle}</strong>.</p>
      <p>At this time, your application was not selected. We encourage you to apply for future opportunities.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

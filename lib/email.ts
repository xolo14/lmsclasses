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

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}) {
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
  const loginUrl = `${appUrl}${loginPath}`;

  return sendEmail({
    to: safeEmail,
    subject: `Welcome to LMS Classes — ${roleLabel} Account`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 24px;">Welcome, ${escapeHtml(name)}!</h2>
        </div>
        
        <div style="font-size: 16px; line-height: 1.5; color: #334155;">
          ${introHtml}
        </div>

        <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">Credentials</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.6; font-family: monospace;">
            ${extras}
            <li><strong>Email:</strong> ${safeEmail}</li>
            <li><strong>Password:</strong> ${escapeHtml(password)}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Login here</a>
        </div>

        <div style="color: #64748b; font-size: 13px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; line-height: 1.6;">
          Please change your password after logging in for the first time if your organization requires it.<br/>
          If you have any questions, feel free to contact us.
        </div>
        <div style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 12px;">
          — LMS Classes (info@lmsclasses.com)
        </div>
      </div>
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

export async function sendWelcomeEmail({
  to,
  name,
  lmsId,
  password,
  courseTitle,
  loginUrl: loginUrlOverride,
}: {
  to: string;
  name: string;
  lmsId: string;
  password: string;
  courseTitle?: string;
  loginUrl?: string;
}) {
  const safeEmail = to.trim().toLowerCase();
  const loginUrl = loginUrlOverride ?? `${appUrl}/login`;
  const subject = courseTitle
    ? `Welcome to LMSClasses — Your ${courseTitle} enrollment is confirmed!`
    : `Welcome to LMSClasses — Your student account is ready!`;

  const courseBlock = courseTitle
    ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">Course Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.6;">
            <li><strong>You've been enrolled in:</strong> ${escapeHtml(courseTitle)}</li>
          </ul>
        </div>`
    : `
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          You can log in and browse available courses at any time.
        </p>`;

  const intro = courseTitle
    ? `<p style="font-size: 16px; line-height: 1.5; color: #334155;">
          You have been successfully registered for your course. Below are your course details and login credentials:
        </p>`
    : `<p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Your student account has been created. Below are your login credentials:
        </p>`;

  const textBody = courseTitle
    ? `Welcome, ${name}!\n\nYou've been enrolled in: ${courseTitle}\n\nLMS ID: ${lmsId}\nEmail: ${safeEmail}\nPassword: ${password}\n\nLogin: ${loginUrl}`
    : `Welcome, ${name}!\n\nYour student account is ready. Log in and browse courses at any time.\n\nLMS ID: ${lmsId}\nEmail: ${safeEmail}\nPassword: ${password}\n\nLogin: ${loginUrl}`;

  return sendEmail({
    to: safeEmail,
    subject,
    text: textBody,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 24px;">Welcome, ${escapeHtml(name)}!</h2>
        </div>
        
        ${intro}
        ${courseBlock}

        <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">Student Credentials</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.6; font-family: monospace;">
            <li><strong>LMS ID:</strong> ${escapeHtml(lmsId)}</li>
            <li><strong>Email:</strong> ${safeEmail}</li>
            <li><strong>Password:</strong> ${escapeHtml(password)}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Login here</a>
        </div>

        <div style="color: #64748b; font-size: 13px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; line-height: 1.6;">
          Please change your password after logging in for the first time if your organization requires it.<br/>
          If you have any questions, feel free to contact us.
        </div>
        <div style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 12px;">
          — LMS Classes (info@lmsclasses.com)
        </div>
      </div>
    `,
  });
}

/** @deprecated Use sendWelcomeEmail */
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
  return sendWelcomeEmail({
    to: email,
    name: studentName,
    lmsId,
    password,
    courseTitle: courseName,
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

export async function sendSlotPurchaseEmail({
  email,
  adminName,
  orgName,
  courseTitle,
  slotsCount,
  amount,
  paymentId,
}: {
  email: string;
  adminName: string;
  orgName: string;
  courseTitle: string;
  slotsCount: number;
  amount: string;
  paymentId: string;
}) {
  const loginUrl = `${appUrl}/org-admin`;

  return sendEmail({
    to: email.trim().toLowerCase(),
    subject: `Slots Purchased Successfully — LMS Classes`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #0f766e; margin: 0; font-size: 24px;">Payment Successful!</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Your slots have been successfully credited.</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Hello ${escapeHtml(adminName)},
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Thank you for your purchase. We have credited the slots to your organisation, <strong>${escapeHtml(orgName)}</strong>. Below are the purchase details:
        </p>

        <div style="background-color: #f8fafc; border-left: 4px solid #0f766e; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">Order Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.6;">
            <li><strong>Course Name:</strong> ${escapeHtml(courseTitle)}</li>
            <li><strong>Slots Credited:</strong> ${slotsCount}</li>
            <li><strong>Amount Paid:</strong> INR ${amount}</li>
            <li><strong>Payment ID:</strong> ${paymentId}</li>
          </ul>
        </div>

        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          You can now start adding students to this course from your administrator dashboard.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Go to Dashboard</a>
        </div>

        <div style="color: #64748b; font-size: 13px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; line-height: 1.6;">
          If you have any questions or require an official invoice, please reach out to support.
        </div>
        <div style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 12px;">
          — LMS Classes (info@lmsclasses.com)
        </div>
      </div>
    `,
  });
}

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
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}) {
  const result = await deliverEmail(payload);
  if (!result.ok) {
    throw new Error(result.error ?? "Failed to send email");
  }
  return result;
}

function invoiceEmailBlock(invoiceUrl?: string): string {
  if (!invoiceUrl) return "";
  return `
        <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 16px;">Payment Invoice</h3>
          <p style="margin: 0 0 12px 0; color: #475569; font-size: 14px; line-height: 1.5;">
            Your invoice is attached to this email. You can also download it using the link below.
          </p>
          <a href="${escapeHtml(invoiceUrl)}" style="color: #0f766e; font-weight: bold; text-decoration: none;">Download invoice (PDF)</a>
        </div>`;
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
  invoiceUrl,
  invoiceAttachment,
}: {
  to: string;
  name: string;
  lmsId: string;
  password: string;
  courseTitle?: string;
  loginUrl?: string;
  invoiceUrl?: string;
  invoiceAttachment?: { filename: string; content: Buffer };
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
    ? `Welcome, ${name}!\n\nYou've been enrolled in: ${courseTitle}\n\nLMS ID: ${lmsId}\nEmail: ${safeEmail}\nPassword: ${password}\n\nLogin: ${loginUrl}${invoiceUrl ? `\n\nInvoice: ${invoiceUrl}` : ""}`
    : `Welcome, ${name}!\n\nYour student account is ready. Log in and browse courses at any time.\n\nLMS ID: ${lmsId}\nEmail: ${safeEmail}\nPassword: ${password}\n\nLogin: ${loginUrl}`;

  return sendEmail({
    to: safeEmail,
    subject,
    text: textBody,
    attachments: invoiceAttachment
      ? [{ filename: invoiceAttachment.filename, content: invoiceAttachment.content }]
      : undefined,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 24px;">Welcome, ${escapeHtml(name)}!</h2>
        </div>
        
        ${intro}
        ${courseBlock}
        ${invoiceEmailBlock(invoiceUrl)}

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
}: {
  email: string;
  hrName: string;
  companyName: string;
}) {
  const safeEmail = email.trim().toLowerCase();
  const loginUrl = `${appUrl}/hr/login`;
  return sendEmail({
    to: safeEmail,
    subject: "Welcome to LMS Classes — HR Account",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <h2 style="color: #0284c7; margin: 0 0 16px;">Welcome, ${escapeHtml(hrName)}!</h2>
        <p>Your HR account for <strong>${escapeHtml(companyName)}</strong> is ready.</p>
        <p>Sign in with the email and password you chose during registration.</p>
        <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Login here</a>
        </div>
        <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
      </div>
    `,
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
      <h2>Hello ${escapeHtml(mentorName)},</h2>
      <p>A new live class has been assigned to you.</p>
      <ul>
        <li><strong>Title:</strong> ${escapeHtml(title)}</li>
        <li><strong>Course:</strong> ${escapeHtml(courseName)}</li>
        ${batchName ? `<li><strong>Batch:</strong> ${escapeHtml(batchName)}</li>` : ""}
        <li><strong>Scheduled:</strong> ${escapeHtml(scheduledAt)}</li>
        ${meetingLink ? `<li><strong>Meeting Link:</strong> <a href="${escapeHtml(meetingLink)}">${escapeHtml(meetingLink)}</a></li>` : ""}
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
      <p style="font-size:24px;font-weight:700;letter-spacing:2px">${escapeHtml(otp)}</p>
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
      <h2>Hello ${escapeHtml(hrName)},</h2>
      <p>Your job <strong>${escapeHtml(jobTitle)}</strong> for <strong>${escapeHtml(companyName)}</strong> is now live.</p>
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
      <h2>Hello ${escapeHtml(hrName)},</h2>
      <p><strong>${escapeHtml(applicantName)}</strong> applied for <strong>${escapeHtml(jobTitle)}</strong>.</p>
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
      <h2>Hello ${escapeHtml(applicantName)},</h2>
      <p>Your application for <strong>${escapeHtml(jobTitle)}</strong> has been shortlisted.</p>
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
      <h2>Hello ${escapeHtml(applicantName)},</h2>
      <p>Thank you for applying to <strong>${escapeHtml(jobTitle)}</strong>.</p>
      <p>At this time, your application was not selected. We encourage you to apply for future opportunities.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">— ${appName} (info@lmsclasses.com)</p>
    `,
  });
}

export async function sendPartnerStudentCredentialsEmail({
  to,
  name,
  courseTitle,
  lmsId,
  password,
  username,
}: {
  to: string;
  name: string;
  courseTitle: string;
  lmsId: string;
  password: string;
  username?: string;
}) {
  const loginUrl = `${appUrl}/login`;
  const safeEmail = to.trim().toLowerCase();

  return sendEmail({
    to: safeEmail,
    subject: "Welcome to LMS Classes — Your Login Details Inside 🎓",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
        <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #E30613; margin: 0; font-size: 24px;">Welcome to LMS Classes</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Your course access is ready</p>
        </div>

        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          Hello ${escapeHtml(name)},
        </p>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          You have been enrolled in <strong>${escapeHtml(courseTitle)}</strong>. Use the credentials below to log in.
        </p>

        <div style="background-color: #F4F4F0; border-left: 4px solid #E30613; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">Your Login Credentials</h3>
          <ul style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.8; font-family: monospace; font-size: 15px;">
            ${username ? `<li><strong>Username:</strong> ${escapeHtml(username)}</li>` : ""}
            <li><strong>LMS ID:</strong> ${escapeHtml(lmsId)}</li>
            <li><strong>Email:</strong> ${safeEmail}</li>
            <li><strong>Password:</strong> ${escapeHtml(password)}</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background-color: #E30613; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 16px;">Login to Your Course</a>
        </div>

        <div style="color: #64748b; font-size: 13px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; line-height: 1.6;">
          Please change your password after your first login.<br/>
          Login URL: <a href="${loginUrl}" style="color: #0f766e;">${loginUrl}</a>
        </div>
        <div style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 12px;">
          — LMS Classes (info@lmsclasses.com)
        </div>
      </div>
    `,
    text: `Welcome ${name}!\n\nCourse: ${courseTitle}\nLMS ID: ${lmsId}\nEmail: ${safeEmail}\nPassword: ${password}\n\nLogin: ${loginUrl}\n\nPlease change your password after first login.`,
  });
}

export async function sendPaymentFailedFollowUpEmail({
  to,
  name,
  courseName,
  paymentUrl,
}: {
  to: string;
  name: string;
  courseName: string;
  paymentUrl: string;
}) {
  const safeEmail = to.trim().toLowerCase();
  return sendEmail({
    to: safeEmail,
    subject: `Complete your enrollment in ${courseName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #E30613; margin-top: 0;">Complete your enrollment</h2>
        <p style="color: #334155; line-height: 1.6;">
          Hi ${escapeHtml(name)}, your payment for <strong>${escapeHtml(courseName)}</strong> didn't go through.
        </p>
        <p style="color: #334155; line-height: 1.6;">
          You can complete enrollment securely using the link below:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${paymentUrl}" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 4px; font-weight: bold;">Complete Payment →</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">If you need help, reply to this email or contact info@lmsclasses.com.</p>
      </div>
    `,
    text: `Hi ${name},\n\nYour payment for ${courseName} didn't go through.\n\nComplete payment: ${paymentUrl}\n`,
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
  invoiceUrl,
  invoiceAttachment,
}: {
  email: string;
  adminName: string;
  orgName: string;
  courseTitle: string;
  slotsCount: number;
  amount: string;
  paymentId: string;
  invoiceUrl?: string;
  invoiceAttachment?: { filename: string; content: Buffer };
}) {
  const loginUrl = `${appUrl}/org-admin`;

  return sendEmail({
    to: email.trim().toLowerCase(),
    subject: `Slots Purchased Successfully — LMS Classes`,
    attachments: invoiceAttachment
      ? [{ filename: invoiceAttachment.filename, content: invoiceAttachment.content }]
      : undefined,
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

        ${invoiceEmailBlock(invoiceUrl)}

        <p style="font-size: 16px; line-height: 1.5; color: #334155;">
          You can now start adding students to this course from your administrator dashboard.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${loginUrl}" style="background-color: #0f766e; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Go to Dashboard</a>
        </div>

        <div style="color: #64748b; font-size: 13px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; line-height: 1.6;">
          If you have any questions, please contact support.
        </div>
        <div style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 12px;">
          — LMS Classes (info@lmsclasses.com)
        </div>
      </div>
    `,
  });
}

export async function sendEnrollmentConfirmationEmail({
  to,
  studentName,
  courses,
  loginUrl,
}: {
  to: string;
  studentName: string;
  courses: { title: string; accessLabel: string }[];
  loginUrl: string;
}) {
  const blocks = courses
    .map(
      (c) =>
        `<li><strong>${escapeHtml(c.title)}</strong> — ${escapeHtml(c.accessLabel)}</li>`
    )
    .join("");
  await sendEmail({
    to,
    subject: `You're enrolled in ${courses.length} course(s) on LMS Classes`,
    html: `<p>Hi ${escapeHtml(studentName)},</p><ul>${blocks}</ul><p><a href="${loginUrl}">Login to your portal</a></p>`,
  });
}

export async function sendEnrollmentRevokedEmail({
  to,
  studentName,
  courseTitle,
  reason,
}: {
  to: string;
  studentName: string;
  courseTitle: string;
  reason: string;
}) {
  await sendEmail({
    to,
    subject: `Enrollment update for ${courseTitle}`,
    html: `<p>Hi ${escapeHtml(studentName)}, your enrollment in ${escapeHtml(courseTitle)} was deactivated. Reason: ${escapeHtml(reason)}</p>`,
  });
}

export async function sendCertificateEmail(params: {
  to: string;
  studentName: string;
  courseName: string;
  certificateNumber: string;
  verifyUrl: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}) {
  const {
    to,
    studentName,
    courseName,
    certificateNumber,
    verifyUrl,
    pdfBuffer,
    pdfFilename,
  } = params;

  await sendEmail({
    to,
    subject: `Your certificate for ${courseName} is ready`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0f172a; color: #fff; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 22px;">${escapeHtml(appName)}</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; color: #334155;">
          <p style="font-size: 18px; font-weight: 600; color: #0f172a;">Congratulations, ${escapeHtml(studentName)}!</p>
          <p>Your certificate of completion for <strong>${escapeHtml(courseName)}</strong> is ready.</p>
          <p style="font-family: monospace; color: #0f766e;">Certificate No: ${escapeHtml(certificateNumber)}</p>
          <p style="margin: 24px 0;">
            <a href="${escapeHtml(verifyUrl)}" style="display: inline-block; background: #06b6d4; color: #0f172a; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View &amp; Verify Certificate</a>
          </p>
          <p style="font-size: 14px; color: #64748b;">Verify authenticity: <a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
          <p style="font-size: 14px; color: #64748b;">Your certificate is attached to this email as a PDF. You can also download it anytime from your student portal.</p>
          <p style="margin-top: 24px; font-size: 14px;">— ${escapeHtml(appName)} Team</p>
        </div>
      </div>
    `,
    attachments: [{ filename: pdfFilename, content: pdfBuffer }],
  });
}

/* ------------------------------------------------------------------ */
/* Google Calendar / Meet integration                                  */
/* ------------------------------------------------------------------ */

function googleEmailShell(title: string, bodyHtml: string): string {
  return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0f172a; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 20px;">${escapeHtml(appName)}</h2>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; color: #334155; line-height: 1.6;">
          <p style="font-size: 17px; font-weight: 600; color: #0f172a; margin-top: 0;">${escapeHtml(title)}</p>
          ${bodyHtml}
          <p style="color:#64748b;font-size:12px;margin-top:24px">— ${escapeHtml(appName)} (info@lmsclasses.com)</p>
        </div>
      </div>`;
}

function emailButton(href: string, label: string): string {
  return `<p style="margin: 24px 0;"><a href="${escapeHtml(href)}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">${escapeHtml(label)}</a></p>`;
}

/** Sent once when a user's Google connection flips to needs_reconnect (revoked / expired). */
export async function sendGoogleReconnectEmail({
  email,
  name,
  reason,
  integrationsPath,
}: {
  email: string;
  name: string;
  reason?: string;
  integrationsPath: string;
}) {
  const url = `${appUrl}${integrationsPath}`;
  await sendEmail({
    to: email,
    subject: `Action needed: reconnect Google Calendar on ${appName}`,
    html: googleEmailShell(
      `Hi ${name},`,
      `
          <p>Your Google Calendar connection on ${escapeHtml(appName)} has stopped working, so new live classes
          cannot get a Google Meet link until you reconnect.</p>
          ${reason ? `<p style="color:#64748b;font-size:14px;">Reason: ${escapeHtml(reason)}</p>` : ""}
          ${emailButton(url, "Reconnect Google Calendar")}
          <p style="font-size:14px;color:#64748b;">Classes that are already scheduled keep their existing Meet links.</p>`
    ),
  });
}

/** Sent to a host who has a class waiting on a Google connection (and by the Super Admin reminder action). */
export async function sendGoogleHostConnectEmail({
  email,
  name,
  classTitle,
  scheduledAt,
  integrationsPath,
}: {
  email: string;
  name: string;
  classTitle?: string;
  scheduledAt?: string;
  integrationsPath: string;
}) {
  const url = `${appUrl}${integrationsPath}`;
  await sendEmail({
    to: email,
    subject: classTitle
      ? `Connect Google to create the Meet link for "${classTitle}"`
      : `Connect Google Calendar on ${appName}`,
    html: googleEmailShell(
      `Hi ${name},`,
      `
          ${
            classTitle
              ? `<p>The live class <strong>${escapeHtml(classTitle)}</strong>${scheduledAt ? ` scheduled for <strong>${escapeHtml(scheduledAt)}</strong>` : ""} is waiting for a Google Meet link.</p>`
              : `<p>Connect your Google account so ${escapeHtml(appName)} can create Google Meet links and calendar invites for your live classes automatically.</p>`
          }
          <p>Connect your Google account once and we will create the calendar event and Meet link on your calendar automatically.</p>
          ${emailButton(url, "Connect Google Calendar")}`
    ),
  });
}

/**
 * Branded "class scheduled" email. Uses the LMS join URL (never the raw Meet link) so access is
 * enforced server-side and attendance is recorded.
 */
export async function sendLiveClassScheduledEmail({
  email,
  name,
  classTitle,
  courseName,
  batchName,
  scheduledAt,
  durationMinutes,
  joinUrl,
  calendarHtmlLink,
  isHost,
}: {
  email: string;
  name: string;
  classTitle: string;
  courseName: string;
  batchName?: string | null;
  scheduledAt: string;
  durationMinutes?: number | null;
  joinUrl: string;
  calendarHtmlLink?: string | null;
  isHost?: boolean;
}) {
  await sendEmail({
    to: email,
    subject: `${isHost ? "You're hosting" : "Live class"}: ${classTitle} — ${scheduledAt}`,
    html: googleEmailShell(
      `Hi ${name},`,
      `
          <p>${isHost ? "You are hosting a live class." : "A live class has been scheduled for you."}</p>
          <ul style="padding-left: 18px;">
            <li><strong>Class:</strong> ${escapeHtml(classTitle)}</li>
            <li><strong>Course:</strong> ${escapeHtml(courseName)}</li>
            ${batchName ? `<li><strong>Batch:</strong> ${escapeHtml(batchName)}</li>` : ""}
            <li><strong>When:</strong> ${escapeHtml(scheduledAt)}</li>
            ${durationMinutes ? `<li><strong>Duration:</strong> ${durationMinutes} minutes</li>` : ""}
          </ul>
          ${emailButton(joinUrl, "Join class")}
          <p style="font-size:14px;color:#64748b;">The join button opens 10 minutes before the class starts.</p>
          ${
            calendarHtmlLink && isHost
              ? `<p style="font-size:14px;"><a href="${escapeHtml(calendarHtmlLink)}">Open in Google Calendar</a></p>`
              : ""
          }`
    ),
  });
}

/** Sent to the host and Super Admins when Meet creation has failed 5 times. */
export async function sendGoogleMeetFailureEmail({
  email,
  name,
  classTitle,
  scheduledAt,
  error,
  classPath,
}: {
  email: string;
  name: string;
  classTitle: string;
  scheduledAt: string;
  error: string;
  classPath: string;
}) {
  await sendEmail({
    to: email,
    subject: `Meet link could not be created: ${classTitle}`,
    html: googleEmailShell(
      `Hi ${name},`,
      `
          <p>${escapeHtml(appName)} tried five times to create a Google Meet link for
          <strong>${escapeHtml(classTitle)}</strong> (${escapeHtml(scheduledAt)}) and gave up.</p>
          <p style="color:#64748b;font-size:14px;">Last error: ${escapeHtml(error)}</p>
          <p>Open the class and either retry, reconnect Google, or paste a meeting link manually.</p>
          ${emailButton(`${appUrl}${classPath}`, "Open live classes")}`
    ),
  });
}

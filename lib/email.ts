import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "LMS Platform <onboarding@resend.dev>";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const appName = process.env.NEXT_PUBLIC_APP_NAME || "LMS Platform";

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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] Student welcome (mock):", { email, lmsId, password });
    return;
  }

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `Welcome to ${appName} — Your Login Details`,
    html: `
      <h2>Welcome, ${studentName}!</h2>
      <p>You have been enrolled in <strong>${courseName}</strong>.</p>
      <p>Your login credentials:</p>
      <ul>
        <li><strong>LMS ID:</strong> ${lmsId}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p><a href="${appUrl}/login">Login here</a></p>
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] Mentor live class (mock):", { email, title });
    return;
  }

  await resend.emails.send({
    from: fromEmail,
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
    `,
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] Org admin welcome (mock):", { email, password });
    return;
  }

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `Welcome to ${appName} — Organisation Admin Account`,
    html: `
      <h2>Welcome, ${adminName}!</h2>
      <p>Your organisation <strong>${orgName}</strong> has been created.</p>
      <p>Login credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p><a href="${appUrl}/login">Login here</a></p>
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] HR OTP (mock):", { email, otp });
    return;
  }
  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: `Your ${appName} HR verification OTP`,
    html: `
      <h2>HR Email Verification</h2>
      <p>Your OTP is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px">${otp}</p>
      <p>This code expires in 10 minutes.</p>
    `,
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] HR welcome (mock):", { email, companyName });
    return;
  }
  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "HR Account Successfully Created",
    html: `
      <h2>Welcome, ${hrName}!</h2>
      <p>Your HR account for <strong>${companyName}</strong> is successfully created.</p>
      <p><a href="${appUrl}/hr/login">Login here</a></p>
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] Job posted (mock):", { email, jobTitle });
    return;
  }
  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Job Posted Successfully",
    html: `
      <h2>Hello ${hrName},</h2>
      <p>Your job <strong>${jobTitle}</strong> for <strong>${companyName}</strong> is now live.</p>
      <p><a href="${appUrl}/hr/jobs/live">View live jobs</a></p>
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] New application (mock):", { email, jobTitle, applicantName });
    return;
  }
  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "New Application Received",
    html: `
      <h2>Hello ${hrName},</h2>
      <p><strong>${applicantName}</strong> applied for <strong>${jobTitle}</strong>.</p>
      <p><a href="${appUrl}/hr/applications">Open applications</a></p>
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] Application shortlisted (mock):", { email, jobTitle });
    return;
  }
  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Application Shortlisted",
    html: `
      <h2>Hello ${applicantName},</h2>
      <p>Your application for <strong>${jobTitle}</strong> has been shortlisted.</p>
      <p>We will contact you with next steps.</p>
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
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] Application rejected (mock):", { email, jobTitle });
    return;
  }
  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Application Update",
    html: `
      <h2>Hello ${applicantName},</h2>
      <p>Thank you for applying to <strong>${jobTitle}</strong>.</p>
      <p>At this time, your application was not selected. We encourage you to apply for future opportunities.</p>
    `,
  });
}

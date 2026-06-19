import type { PartnerLead } from "@/lib/db/schema";

export function serializeLeadStatus(lead: PartnerLead) {
  return {
    leadId: lead.id,
    name: lead.name,
    email: lead.email,
    course: lead.course,
    courseId: lead.recordCourseId,
    status: lead.status,
    paymentStatus: lead.paymentStatus,
    studentCreated: lead.studentCreated,
    createdAt: lead.createdAt?.toISOString() ?? null,
  };
}

export function buildLeadInsertValues(
  body: Record<string, unknown>,
  meta: {
    apiKeyId: string;
    apiKeyName: string;
    ipAddress?: string;
    userAgent?: string;
    course: string;
    recordCourseId?: string | null;
    courseSlug?: string | null;
    courseFee?: string | null;
  }
) {
  return {
    apiKeyId: meta.apiKeyId,
    apiKeyName: meta.apiKeyName,
    name: String(body.name),
    email: String(body.email).trim().toLowerCase(),
    phone: String(body.phone),
    city: body.city ? String(body.city) : null,
    qualification: body.qualification ? String(body.qualification) : null,
    workingStatus: body.workingStatus ? String(body.workingStatus) : null,
    preferredBatchTime: body.preferredBatchTime ? String(body.preferredBatchTime) : null,
    course: meta.course,
    courseSlug: meta.courseSlug ?? null,
    recordCourseId: meta.recordCourseId ?? null,
    courseFee: meta.courseFee ?? null,
    source: body.source ? String(body.source) : null,
    utmSource: body.utmSource ? String(body.utmSource) : null,
    utmMedium: body.utmMedium ? String(body.utmMedium) : null,
    utmCampaign: body.utmCampaign ? String(body.utmCampaign) : null,
    utmContent: body.utmContent ? String(body.utmContent) : null,
    utmTerm: body.utmTerm ? String(body.utmTerm) : null,
    referralCode: body.referralCode ? String(body.referralCode) : null,
    landingPageUrl: body.landingPageUrl ? String(body.landingPageUrl) : null,
    ipAddress: meta.ipAddress ?? null,
    userAgent: meta.userAgent ?? null,
    paymentStatus: "pending" as const,
    studentCreated: false,
    status: "new" as const,
  };
}

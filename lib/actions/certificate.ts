"use server";

import { auth } from "@/lib/auth";
import { resolveOrganisationId } from "@/lib/api-auth";
import { headers } from "next/headers";
import {
  bulkIssueCertificates,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  getCertificateAnalytics,
  getTemplate,
  issueCertificate,
  listEnrolledStudentsForCourse,
  listIssuedCertificates,
  listTemplates,
  resendCertificateEmail,
  revokeCertificate,
  updateTemplate,
  type CertActor,
} from "@/lib/services/certificate-service";
import {
  bulkIssueSchema,
  createTemplateSchema,
  issueCertificateSchema,
  revokeCertificateSchema,
  updateTemplateSchema,
} from "@/lib/validations/certificate";

async function getActor(): Promise<CertActor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
  const organisationId =
    session.user.role === "org_admin"
      ? await resolveOrganisationId(session)
      : session.user.organisationId ?? null;
  return {
    userId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? "Admin",
    organisationId,
    ipAddress: ip,
  };
}

export async function createTemplateAction(input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
  try {
    const result = await createTemplate(actor, parsed.data);
    return { success: true as const, ...result };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function updateTemplateAction(templateId: string, input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
  try {
    await updateTemplate(actor, templateId, parsed.data);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function deleteTemplateAction(templateId: string) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  try {
    await deleteTemplate(actor, templateId);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function duplicateTemplateAction(templateId: string, newName: string) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  try {
    const result = await duplicateTemplate(actor, templateId, newName);
    return { success: true as const, ...result };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function listTemplatesAction(filters?: Parameters<typeof listTemplates>[1]) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const data = await listTemplates(actor, filters);
  return { success: true as const, data };
}

export async function getTemplateAction(templateId: string) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  try {
    const data = await getTemplate(actor, templateId);
    return { success: true as const, data };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function issueCertificateAction(input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const parsed = issueCertificateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
  try {
    const result = await issueCertificate(actor, parsed.data);
    return { success: true as const, ...result };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function bulkIssueAction(input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const parsed = bulkIssueSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
  try {
    const result = await bulkIssueCertificates(actor, parsed.data);
    return { success: true as const, ...result };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function resendCertificateEmailAction(certificateId: string) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  try {
    await resendCertificateEmail(actor, certificateId);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function revokeCertificateAction(certificateId: string, input: unknown) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const parsed = revokeCertificateSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten() };
  try {
    await revokeCertificate(actor, certificateId, parsed.data.reason);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: (e as Error).message };
  }
}

export async function listIssuedCertificatesAction(
  filters?: Parameters<typeof listIssuedCertificates>[1]
) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const data = await listIssuedCertificates(actor, filters);
  return { success: true as const, data };
}

export async function getCertificateAnalyticsAction() {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const data = await getCertificateAnalytics(actor);
  return { success: true as const, data };
}

export async function listEnrolledStudentsAction(
  courseId: string,
  courseType: "live" | "record",
  templateId?: string
) {
  const actor = await getActor();
  if (!actor) return { success: false as const, error: "Unauthorized" };
  const data = await listEnrolledStudentsForCourse(actor, courseId, courseType, templateId);
  return { success: true as const, data };
}

export async function listStudentCertificatesAction() {
  const actor = await getActor();
  if (!actor || actor.role !== "student") return { success: false as const, error: "Unauthorized" };
  const data = await listIssuedCertificates(actor, { isRevoked: false });
  return { success: true as const, data };
}

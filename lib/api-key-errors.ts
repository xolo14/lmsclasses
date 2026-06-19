import { NextResponse } from "next/server";

export function apiKeyError(
  error: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

export const ApiKeyErrors = {
  invalidKey: () =>
    apiKeyError("INVALID_API_KEY", "API key is missing or invalid", 401),
  expired: (date: string) =>
    apiKeyError("KEY_EXPIRED", `This API key expired on ${date}`, 401),
  disabled: () =>
    apiKeyError("KEY_DISABLED", "This API key has been deactivated", 403),
  permissionDenied: (perm: string) =>
    apiKeyError(
      "PERMISSION_DENIED",
      `This key does not have ${perm} permission`,
      403
    ),
  courseNotAllowed: (course: string, allowed: string[]) =>
    apiKeyError(
      "COURSE_NOT_ALLOWED",
      `This key cannot submit leads for '${course}'. Allowed: ${allowed.join(", ") || "none"}`,
      403,
      { allowedCourses: allowed }
    ),
  ipNotWhitelisted: (ip: string) =>
    apiKeyError("IP_NOT_WHITELISTED", `Request from ${ip} is not allowed for this key`, 403),
  duplicateLead: (leadId: string) =>
    apiKeyError("DUPLICATE_LEAD", "Lead already exists", 409, { leadId }),
  validationFailed: (fields: Record<string, string>) =>
    apiKeyError("VALIDATION_FAILED", "Validation failed", 422, { fields }),
  rateLimitExceeded: (limit: number, windowMinutes: number) =>
    apiKeyError(
      "RATE_LIMIT_EXCEEDED",
      `Limit: ${limit} requests per ${windowMinutes} minutes`,
      429
    ),
  notFound: (entity = "Resource") =>
    apiKeyError("NOT_FOUND", `${entity} not found`, 404),
  paymentInvalid: (message: string) =>
    apiKeyError("PAYMENT_INVALID", message, 400),
};

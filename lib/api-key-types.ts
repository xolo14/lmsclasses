export const API_KEY_PREFIX_LIVE = "lms_live_";
export const API_KEY_PREFIX_TEST = "lms_test_";

export const API_PERMISSIONS = [
  "submit_lead",
  "update_lead",
  "get_lead_status",
  "list_own_leads",
  "confirm_payment",
  "create_payment_order",
  "verify_payment",
  "get_course_list",
  "get_batch_schedule",
  "resend_credentials",
  "check_student_exists",
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];

export const PERMISSION_GROUPS = {
  Lead: ["submit_lead", "update_lead", "get_lead_status", "list_own_leads"] as const,
  Payment: ["create_payment_order", "confirm_payment", "verify_payment"] as const,
  Student: ["resend_credentials", "check_student_exists"] as const,
  Info: ["get_course_list", "get_batch_schedule"] as const,
};

export const DEFAULT_LEAD_FIELDS = {
  required: ["name", "email", "phone", "course"],
  optional: [
    "city",
    "qualification",
    "workingStatus",
    "preferredBatchTime",
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "utmTerm",
    "referralCode",
    "landingPageUrl",
  ],
};

export const DEFAULT_RATE_LIMIT = { requests: 200, windowMinutes: 60 };

export type ApiKeyEnvironment = "live" | "test";

export type LeadFieldsConfig = {
  required?: string[];
  optional?: string[];
};

export type RateLimitConfig = {
  requests: number;
  windowMinutes: number;
};

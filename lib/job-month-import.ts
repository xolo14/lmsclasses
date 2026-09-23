export const MONTHLY_JOB_TARGET = 2000;
export const IMPORT_BATCH_SIZE = 50;

export const PLATFORM_HR_EMAIL = "listings@lms-job-board.internal";
export const PLATFORM_HR_NAME = "Super Admin";
export const PLATFORM_HR_DESIGNATION = "Platform listings";
export const PLATFORM_COMPANY_NAME = "LMS Job Board";
export const PLATFORM_COMPANY_DOMAIN = "lms-job-board.internal";

export type JobEmploymentType = "internship" | "full_time" | "part_time";

export type MonthJobDraft = {
  title: string;
  organisationName: string;
  location: string | null;
  employmentType: JobEmploymentType;
  stipend: string | null;
  salary: string | null;
  ctc: string | null;
  experienceRequired: string | null;
  description: string;
  responsibilities: string | null;
  requiredSkills: string | null;
  postedAt: Date;
  applicationDeadline: Date;
};

const UA = "LMS-Platform/1.0 (month job import)";
const FETCH_MS = 12_000;
const DESC_MAX = 1_800;
const ARBEITNOW_PAGES = 8;

const ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "React Developer",
  "Node.js Developer",
  "Python Developer",
  "Java Developer",
  "Android Developer",
  "iOS Developer",
  "QA Engineer",
  "SDET",
  "Data Analyst",
  "Data Engineer",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Cybersecurity Analyst",
  "UI/UX Designer",
  "Product Designer",
  "Product Manager",
  "Project Coordinator",
  "Business Analyst",
  "Technical Writer",
  "Support Engineer",
  "IT Recruiter",
  "HR Executive",
  "Digital Marketing Executive",
  "SEO Specialist",
  "Content Writer",
  "Sales Development Representative",
  "Account Executive",
  "Customer Success Associate",
  "Operations Associate",
  "Finance Analyst",
  "Graphic Designer",
  "Video Editor",
  "Instructional Designer",
  "LMS Administrator",
  "Education Counselor",
  "Software Engineer Intern",
  "Graduate Engineer Trainee",
  "Associate Software Engineer",
  "Senior Software Engineer",
  "Engineering Manager",
  "Site Reliability Engineer",
  "Salesforce Developer",
  "SAP Consultant",
  "Network Engineer",
  "Business Development Associate",
];

const COMPANIES = [
  "Nimbus Labs",
  "Harbor Digital",
  "Cedar Analytics",
  "Brightlane Tech",
  "Orbit Health",
  "PixelForge",
  "Northwind Systems",
  "Saffron Cloud",
  "Lumen Retail",
  "Aether Finance",
  "Cobalt Robotics",
  "Maple Education",
  "Kite Mobility",
  "Redwood Media",
  "Summit Logistics",
  "Bluepeak Software",
  "Copperfield AI",
  "Willow Payments",
  "Asterisk Foods",
  "Ironwood Energy",
  "Fairway Insurance",
  "Nova Campus",
  "Helio Gadgets",
  "Cinder Design",
  "Prairie Bank",
  "Glacier Networks",
  "Amber Clinics",
  "Silverline Consulting",
  "Oak & Pine",
  "Vertex Learning",
  "Monarch Telecom",
  "Quiet Harbor",
  "Driftwood Apps",
  "Canyon Analytics",
  "Banyan Works",
  "Lotus Commerce",
  "Sparrow Studios",
  "Fieldnote",
  "Copper Trail",
  "Zenith Motors",
];

const CITIES = [
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Mumbai",
  "Gurugram",
  "Noida",
  "Remote",
];

const SKILL_SETS = [
  "JavaScript, TypeScript, React",
  "Python, SQL, Pandas",
  "Java, Spring Boot, REST APIs",
  "Node.js, PostgreSQL, AWS",
  "Figma, user research, prototyping",
  "Selenium, Playwright, CI/CD",
  "Excel, Power BI, stakeholder reporting",
  "SEO, Google Ads, content calendars",
];

export function jobDraftKey(job: { title: string; organisationName: string; location?: string | null }): string {
  return [job.title, job.organisationName, job.location || ""]
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function istParts(date = new Date()) {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
  };
}

export function startOfCurrentIstMonth(now = new Date()): Date {
  const { year, month } = istParts(now);
  return new Date(Date.UTC(year, month, 1, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
}

export function isInCurrentIstMonth(date: Date, now = new Date()): boolean {
  const a = istParts(date);
  const b = istParts(now);
  return a.year === b.year && a.month === b.month;
}

export function currentMonthLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(now);
}

function istDate(year: number, month: number, day: number, hour = 10): Date {
  return new Date(Date.UTC(year, month, day, hour, 0, 0) - 5.5 * 60 * 60 * 1000);
}

function parseMaybeDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return parseMaybeDate(Number(trimmed));
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function asText(value: unknown): string {
  if (typeof value === "string") return stripHtml(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return asText(rec.name ?? rec.value ?? rec.text ?? rec.description ?? "");
  }
  return "";
}

function clip(text: string, max = DESC_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function mapEmployment(raw: string): JobEmploymentType {
  const s = raw.toLowerCase();
  if (s.includes("intern") || s.includes("trainee") || s.includes("graduate")) return "internship";
  if (s.includes("part")) return "part_time";
  return "full_time";
}

function payFields(employmentType: JobEmploymentType, pay: string | null) {
  if (!pay) return { stipend: null, salary: null, ctc: null };
  if (employmentType === "internship") return { stipend: pay, salary: null, ctc: null };
  if (employmentType === "part_time") return { stipend: null, salary: pay, ctc: null };
  return { stipend: null, salary: null, ctc: pay };
}

function deadlineFor(postedAt: Date, now: Date): Date {
  const fromPosted = new Date(postedAt.getTime() + 35 * 24 * 60 * 60 * 1000);
  const min = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  return fromPosted > min ? fromPosted : min;
}

function experienceFor(employmentType: JobEmploymentType, index: number): string {
  if (employmentType === "internship") return "Fresher / campus";
  const bands = ["0-1 years", "1-3 years", "2-4 years", "3-5 years", "5-8 years"];
  return bands[index % bands.length]!;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.json();
}

function toDraft(input: {
  title: string;
  organisationName: string;
  location?: string | null;
  employmentType?: string;
  pay?: string | null;
  experienceRequired?: string | null;
  description: string;
  responsibilities?: string | null;
  requiredSkills?: string | null;
  postedAt: Date;
  sourceLabel: string;
  sourceUrl?: string | null;
  now: Date;
}): MonthJobDraft | null {
  const title = input.title.trim().replace(/\s+/g, " ");
  const organisationName = input.organisationName.trim().replace(/\s+/g, " ");
  if (title.length < 3 || organisationName.length < 2) return null;
  if (!isInCurrentIstMonth(input.postedAt, input.now)) return null;
  const employmentType = mapEmployment(input.employmentType || title);
  const pay = input.pay?.trim() || null;
  const sourceLine = input.sourceUrl
    ? `Source: ${input.sourceLabel} — ${input.sourceUrl}`
    : `Source: ${input.sourceLabel}`;
  return {
    title: title.slice(0, 180),
    organisationName: organisationName.slice(0, 160),
    location: input.location?.trim() || null,
    employmentType,
    ...payFields(employmentType, pay),
    experienceRequired: input.experienceRequired?.trim() || experienceFor(employmentType, title.length),
    description: clip(`${asText(input.description) || `${title} at ${organisationName}.`} ${sourceLine}`),
    responsibilities: input.responsibilities ? clip(asText(input.responsibilities), 800) : null,
    requiredSkills: input.requiredSkills ? clip(asText(input.requiredSkills), 400) : null,
    postedAt: input.postedAt,
    applicationDeadline: deadlineFor(input.postedAt, input.now),
  };
}

async function fetchRemoteOk(now: Date): Promise<MonthJobDraft[]> {
  const raw = await fetchJson("https://remoteok.com/api");
  if (!Array.isArray(raw)) return [];
  const out: MonthJobDraft[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const title = asText(rec.position || rec.title);
    const company = asText(rec.company);
    if (!title || !company) continue;
    const postedAt = parseMaybeDate(rec.epoch ?? rec.date);
    if (!postedAt) continue;
    const draft = toDraft({
      title,
      organisationName: company,
      location: asText(rec.location) || "Remote",
      employmentType: asText(rec.tags),
      pay: asText(rec.salary) || null,
      description: asText(rec.description) || title,
      requiredSkills: asText(rec.tags),
      postedAt,
      sourceLabel: "Remote OK",
      sourceUrl: typeof rec.url === "string" ? rec.url : typeof rec.apply_url === "string" ? rec.apply_url : null,
      now,
    });
    if (draft) out.push(draft);
  }
  return out;
}

async function fetchRemotive(now: Date): Promise<MonthJobDraft[]> {
  const raw = await fetchJson("https://remotive.com/api/remote-jobs");
  const jobs = raw && typeof raw === "object" ? (raw as { jobs?: unknown }).jobs : null;
  if (!Array.isArray(jobs)) return [];
  const out: MonthJobDraft[] = [];
  for (const row of jobs) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const postedAt = parseMaybeDate(rec.publication_date);
    if (!postedAt) continue;
    const draft = toDraft({
      title: asText(rec.title),
      organisationName: asText(rec.company_name),
      location: asText(rec.candidate_required_location) || "Remote",
      employmentType: asText(rec.job_type),
      pay: asText(rec.salary) || null,
      description: asText(rec.description),
      requiredSkills: asText(rec.tags),
      postedAt,
      sourceLabel: "Remotive",
      sourceUrl: typeof rec.url === "string" ? rec.url : null,
      now,
    });
    if (draft) out.push(draft);
  }
  return out;
}

async function fetchArbeitnowPage(page: number): Promise<{ jobs: Record<string, unknown>[]; complete: boolean }> {
  const raw = await fetchJson(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
  const jobs = raw && typeof raw === "object" ? (raw as { data?: unknown }).data : null;
  return { jobs: Array.isArray(jobs) ? (jobs as Record<string, unknown>[]) : [], complete: !Array.isArray(jobs) };
}

async function fetchArbeitnow(now: Date): Promise<MonthJobDraft[]> {
  const out: MonthJobDraft[] = [];
  const started = Date.now();
  for (let page = 1; page <= ARBEITNOW_PAGES; page += 1) {
    if (Date.now() - started > 20_000) break;
    const { jobs } = await fetchArbeitnowPage(page);
    if (!jobs.length) break;
    let monthHits = 0;
    for (const rec of jobs) {
      const postedAt = parseMaybeDate(rec.created_at);
      if (!postedAt) continue;
      const draft = toDraft({
        title: asText(rec.title),
        organisationName: asText(rec.company_name),
        location: asText(rec.location) || (rec.remote ? "Remote" : null),
        employmentType: asText(rec.job_types),
        description: asText(rec.description),
        requiredSkills: asText(rec.tags),
        postedAt,
        sourceLabel: "Arbeitnow",
        sourceUrl: typeof rec.url === "string" ? rec.url : null,
        now,
      });
      if (draft) {
        monthHits += 1;
        out.push(draft);
      }
    }
    if (monthHits === 0 || out.length >= MONTHLY_JOB_TARGET) break;
  }
  return out;
}

export async function fetchPublicMonthJobs(now = new Date()): Promise<{ drafts: MonthJobDraft[]; sources: string[]; errors: string[] }> {
  const sources: string[] = [];
  const errors: string[] = [];
  const drafts: MonthJobDraft[] = [];

  const tasks: Array<[string, () => Promise<MonthJobDraft[]>]> = [
    ["Remote OK", () => fetchRemoteOk(now)],
    ["Remotive", () => fetchRemotive(now)],
    ["Arbeitnow", () => fetchArbeitnow(now)],
  ];

  const results = await Promise.allSettled(tasks.map(([, run]) => run()));
  results.forEach((result, index) => {
    const name = tasks[index]![0];
    if (result.status === "fulfilled") {
      drafts.push(...result.value);
      sources.push(`${name} (${result.value.length})`);
    } else {
      errors.push(`${name}: ${result.reason instanceof Error ? result.reason.message : "failed"}`);
    }
  });

  return { drafts, sources, errors };
}

export function buildMonthJobCatalog(count: number, now = new Date()): MonthJobDraft[] {
  const { year, month, day } = istParts(now);
  const drafts: MonthJobDraft[] = [];
  let i = 0;
  outer: for (const company of COMPANIES) {
    for (const role of ROLES) {
      for (const city of CITIES) {
        if (drafts.length >= count) break outer;
        const cleanRole = role.trim();
        const employmentType = mapEmployment(cleanRole);
        const postedAt = istDate(year, month, 1 + (i % day), 8 + (i % 9));
        const skills = SKILL_SETS[i % SKILL_SETS.length]!;
        const pay =
          employmentType === "internship"
            ? `₹${12 + (i % 8)}k / month`
            : employmentType === "part_time"
              ? `₹${25 + (i % 20)}k / month`
              : `₹${6 + (i % 24)}-${10 + (i % 24)} LPA`;
        drafts.push({
          title: cleanRole,
          organisationName: company,
          location: city,
          employmentType,
          ...payFields(employmentType, pay),
          experienceRequired: experienceFor(employmentType, i),
          description: clip(
            `${cleanRole} opening at ${company} in ${city} for ${currentMonthLabel(now)}. ` +
              `Work with a small team on production features, reviews, and student-facing delivery. ` +
              `Required skills: ${skills}.`
          ),
          responsibilities: clip(
            `Own sprint work for ${cleanRole.toLowerCase()} deliverables, collaborate with mentors, and document handoff.`,
            400
          ),
          requiredSkills: skills,
          postedAt,
          applicationDeadline: deadlineFor(postedAt, now),
        });
        i += 1;
      }
    }
  }
  return drafts;
}

export function mergeMonthJobDrafts(
  fetched: MonthJobDraft[],
  catalog: MonthJobDraft[],
  existingKeys: Set<string>,
  needed: number
): MonthJobDraft[] {
  const out: MonthJobDraft[] = [];
  const seen = new Set(existingKeys);
  for (const draft of [...fetched, ...catalog]) {
    if (out.length >= needed) break;
    const key = jobDraftKey(draft);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(draft);
  }
  return out;
}

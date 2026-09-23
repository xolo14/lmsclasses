import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { toDatetimeLocalValue } from "@/lib/utils";
import type { HrJobInput } from "@/lib/validations";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_200_000;
const MAX_REDIRECTS = 2;

export type ImportedJobDraft = Partial<HrJobInput> & {
  title: string;
  organisationName: string;
  description: string;
  source: "json-ld" | "meta";
};

function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "127.0.0.1" || v === "0.0.0.0" || v === "::1" || v === "::") return true;
  if (v.includes(":")) {
    return v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("::ffff:127.");
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return true;
  if (p[0] === 10 || p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 172 && (p[1] ?? 0) >= 16 && (p[1] ?? 0) <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  return false;
}

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a valid http or https job URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be imported.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host cannot be imported.");
  }
  let ips: string[] = [];
  try {
    ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((row) => row.address);
  } catch {
    throw new Error("Could not resolve that host.");
  }
  if (!ips.length || ips.some((addr) => isPrivateIp(addr))) {
    throw new Error("That host cannot be imported.");
  }
  return url;
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

function employmentTypeFrom(value: unknown): HrJobInput["employmentType"] {
  const raw = (Array.isArray(value) ? value.join(" ") : asText(value)).toLowerCase();
  if (raw.includes("intern")) return "internship";
  if (raw.includes("part")) return "part_time";
  return "full_time";
}

function locationFrom(value: unknown): string {
  if (typeof value === "string") return stripHtml(value);
  if (Array.isArray(value)) return value.map(locationFrom).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const addr = (rec.address && typeof rec.address === "object" ? rec.address : rec) as Record<string, unknown>;
    const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry, rec.name]
      .map(asText)
      .filter(Boolean);
    return [...new Set(parts)].join(", ");
  }
  return "";
}

function salaryFrom(value: unknown): string {
  if (!value || typeof value !== "object") return asText(value);
  const rec = value as Record<string, unknown>;
  const valueObj = rec.value && typeof rec.value === "object" ? (rec.value as Record<string, unknown>) : rec;
  const min = asText(valueObj.minValue);
  const max = asText(valueObj.maxValue);
  const unit = asText(valueObj.unitText || rec.unitText);
  const currency = asText(valueObj.currency || rec.currency);
  const range = [min, max].filter(Boolean).join(" - ");
  return [currency, range, unit].filter(Boolean).join(" ").trim();
}

function walkJsonLd(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, out);
    return;
  }
  if (typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  const types = Array.isArray(rec["@type"]) ? rec["@type"] : [rec["@type"]];
  if (types.some((t) => String(t).toLowerCase() === "jobposting")) out.push(rec);
  if (rec["@graph"]) walkJsonLd(rec["@graph"], out);
}

function parseJsonLdJobs(html: string): Record<string, unknown>[] {
  const jobs: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      walkJsonLd(JSON.parse(raw), jobs);
    } catch {
      /* ignore broken blocks */
    }
  }
  return jobs;
}

function metaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return stripHtml(m[1]);
  }
  return "";
}

function titleTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1] ? stripHtml(m[1]) : "";
}

function draftFromJobPosting(job: Record<string, unknown>): ImportedJobDraft {
  const org = asText(job.hiringOrganization) || asText(job.hiringOrganisation);
  const title = asText(job.title);
  const description = asText(job.description) || asText(job.jobDescription);
  const validThrough = asText(job.validThrough);
  let applicationDeadline = "";
  if (validThrough) {
    const d = new Date(validThrough);
    if (!Number.isNaN(d.getTime())) applicationDeadline = toDatetimeLocalValue(d);
  }
  if (!applicationDeadline) {
    applicationDeadline = toDatetimeLocalValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  }
  const pay = salaryFrom(job.baseSalary);
  const employmentType = employmentTypeFrom(job.employmentType);
  return {
    title: title || "Imported job",
    organisationName: org || "Company",
    location: locationFrom(job.jobLocation) || asText(job.jobLocationType),
    employmentType,
    description: description || title || "Imported from a public job page.",
    responsibilities: asText(job.responsibilities),
    requiredSkills: asText(job.skills) || asText(job.qualifications),
    eligibilityCriteria: asText(job.educationRequirements) || asText(job.experienceRequirements),
    experienceRequired: asText(job.experienceRequirements),
    applicationDeadline,
    openings: Number(job.totalJobOpenings) > 0 ? Number(job.totalJobOpenings) : 1,
    stipend: employmentType === "internship" ? pay : "",
    salary: employmentType === "part_time" ? pay : "",
    ctc: employmentType === "full_time" ? pay : "",
    source: "json-ld",
  };
}

async function readPublicHtml(start: URL): Promise<string> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHttpUrl(current.toString());
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "LMSClassesJobImport/1.0",
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("The job page took too long to respond.");
      }
      throw new Error("Could not reach that job page.");
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new Error("The job page redirected without a location.");
      current = new URL(next, current);
      continue;
    }

    if (!res.ok) {
      throw new Error(
        `That page returned HTTP ${res.status}. Use a public company careers URL, or fill the form by hand.`
      );
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("That page is too large to import.");
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  }
  throw new Error("Too many redirects.");
}

/** Fetch a public job page and map schema.org JobPosting (or page meta) into the HR form. */
export async function importJobFromPublicUrl(rawUrl: string): Promise<ImportedJobDraft> {
  const url = await assertPublicHttpUrl(rawUrl);
  const html = await readPublicHtml(url);
  const jobs = parseJsonLdJobs(html);
  if (jobs[0]) return draftFromJobPosting(jobs[0]);

  const title = metaContent(html, "og:title") || titleTag(html);
  const description =
    metaContent(html, "og:description") || metaContent(html, "description") || title;
  const org = metaContent(html, "og:site_name") || url.hostname.replace(/^www\./, "");
  if (!title || title.length < 2) {
    throw new Error(
      "No JobPosting data on that page. Use a careers URL that publishes schema.org JobPosting, or fill the form by hand."
    );
  }
  return {
    title,
    organisationName: org,
    description: description || title,
    employmentType: "full_time",
    applicationDeadline: toDatetimeLocalValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    openings: 1,
    source: "meta",
  };
}

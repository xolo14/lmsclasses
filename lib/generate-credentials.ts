import { randomBytes, randomInt } from "crypto";
import { customAlphabet } from "nanoid";

const nanoid6 = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function generateUsername(firstName: string): string {
  const base = firstName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12) || "student";
  const suffix = randomInt(1000, 9999);
  return `${base}${suffix}`;
}

export function generateStudentPassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i]! % chars.length];
  }
  return password;
}

export function generatePartnerLmsId(): string {
  return `LMS${nanoid6()}`;
}

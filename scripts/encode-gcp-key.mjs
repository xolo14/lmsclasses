/**
 * Encode a Google service-account JSON key for Hostinger env:
 *   GCP_SERVICE_ACCOUNT_JSON_BASE64=<output>
 *
 * Usage:
 *   node scripts/encode-gcp-key.mjs "C:\path\to\key.json"
 */
import { readFileSync } from "fs";
import { createPrivateKey } from "crypto";

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/encode-gcp-key.mjs "C:\\path\\to\\key.json"');
  process.exit(1);
}

const raw = readFileSync(file, "utf8");
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error("Invalid JSON key file:", err instanceof Error ? err.message : err);
  process.exit(1);
}

try {
  createPrivateKey(parsed.private_key);
  console.error("OK: private_key loads in Node crypto");
} catch (err) {
  console.error(
    "FAIL: private_key is not usable:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
}

const b64 = Buffer.from(raw, "utf8").toString("base64");
console.log("");
console.log("Add this Hostinger env var, then Restart Node:");
console.log("");
console.log("Key:   GCP_SERVICE_ACCOUNT_JSON_BASE64");
console.log("Value: (paste the single line below)");
console.log("");
console.log(b64);
console.log("");
console.log("Also keep: GCS_BUCKET_NAME=lmsclasses-videos");

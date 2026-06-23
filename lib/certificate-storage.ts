import { readFile } from "fs/promises";
import type { IssuedCertificate } from "@/lib/db/schema";
import { resolveUploadDiskPath, saveUploadFile } from "@/lib/uploads";

export function certificatePdfFilename(certificateNumber: string) {
  return `${certificateNumber.replace(/[^a-zA-Z0-9.-]/g, "_")}.pdf`;
}

/** Save under {UPLOADS_DIR}/certificates/ — e.g. Hostinger: .../nodejs/uploads/certificates/ */
export async function saveCertificatePdf(certificateNumber: string, data: Buffer) {
  const filename = certificatePdfFilename(certificateNumber);
  return saveUploadFile("certificates", filename, data);
}

type CertPdfSource = Pick<
  IssuedCertificate,
  "pdfData" | "pdfUrl" | "pdfStoragePath" | "certificateNumber"
>;

/** Read from disk first; fall back to legacy base64 in Neon for older rows. */
export async function readCertificatePdf(cert: CertPdfSource): Promise<Buffer> {
  if (cert.pdfUrl) {
    const segments = cert.pdfUrl.replace(/^\//, "").replace(/^uploads\//, "").split("/");
    const diskPath = resolveUploadDiskPath(segments);
    if (diskPath) {
      try {
        return await readFile(diskPath);
      } catch {
        // file missing on disk — try pdfStoragePath / legacy base64
      }
    }
  }

  if (cert.pdfStoragePath) {
    try {
      return await readFile(cert.pdfStoragePath);
    } catch {
      // continue to legacy fallback
    }
  }

  if (cert.pdfData) {
    return Buffer.from(cert.pdfData, "base64");
  }

  throw new Error("PDF not found");
}

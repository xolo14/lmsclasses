import { readFile } from "fs/promises";
import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, liveCourses, recordCourses, organisations } from "@/lib/db/schema";
import { getAppUrl } from "@/lib/app-url";
import { saveUploadFile, type UploadCategory } from "@/lib/uploads";

export type InvoiceContext = {
  customerName: string;
  orgName?: string;
};

export type PaymentInvoiceResult = {
  invoiceUrl: string;
  absoluteUrl: string;
  pdfBuffer: Buffer;
  filename: string;
};

function formatInvoiceDate(date: Date | null): string {
  if (!date) return new Date().toLocaleDateString("en-IN");
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function invoiceNumber(paymentId: string): string {
  return `INV-${paymentId.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function buildInvoicePdf(data: {
  invoiceNo: string;
  date: string;
  customerName: string;
  orgName?: string;
  courseTitle: string;
  description: string;
  quantity: number;
  amount: string;
  razorpayPaymentId: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(22).fillColor("#0f766e").text("LMS Classes", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#64748b").text("info@lmsclasses.com");
    doc.moveDown(1.5);

    doc.fontSize(24).fillColor("#0f172a").text("INVOICE", { align: "right" });
    doc.fontSize(10).fillColor("#475569");
    doc.text(`Invoice No: ${data.invoiceNo}`, { align: "right" });
    doc.text(`Date: ${data.date}`, { align: "right" });
    doc.moveDown(2);

    doc.fontSize(11).fillColor("#0f172a").text("Billed To");
    doc.fontSize(10).fillColor("#334155");
    doc.text(data.customerName);
    if (data.orgName) {
      doc.text(data.orgName);
    }
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.fontSize(10).fillColor("#0f172a");
    doc.text("Description", 50, tableTop);
    doc.text("Qty", 320, tableTop);
    doc.text("Amount (INR)", 420, tableTop, { width: 120, align: "right" });
    doc
      .moveTo(50, tableTop + 16)
      .lineTo(545, tableTop + 16)
      .strokeColor("#e2e8f0")
      .stroke();

    const rowY = tableTop + 24;
    doc.fillColor("#334155");
    doc.text(data.courseTitle, 50, rowY, { width: 250 });
    doc.fontSize(9).fillColor("#64748b").text(data.description, 50, rowY + 14, { width: 250 });
    doc.fontSize(10).fillColor("#334155");
    doc.text(String(data.quantity), 320, rowY);
    doc.text(data.amount, 420, rowY, { width: 120, align: "right" });

    doc.moveDown(4);
    const totalY = doc.y;
    doc
      .fontSize(12)
      .fillColor("#0f172a")
      .text("Total Paid", 320, totalY)
      .text(`INR ${data.amount}`, 420, totalY, { width: 120, align: "right" });

    if (data.razorpayPaymentId) {
      doc.moveDown(2);
      doc.fontSize(9).fillColor("#64748b").text(`Razorpay Payment ID: ${data.razorpayPaymentId}`);
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#94a3b8").text("Thank you for your payment.", { align: "center" });

    doc.end();
  });
}

export async function generatePaymentInvoice(
  paymentId: string,
  context: InvoiceContext
): Promise<PaymentInvoiceResult | null> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || payment.status !== "success") {
    return null;
  }

  if (payment.invoiceUrl) {
    try {
      const relativePath = payment.invoiceUrl.replace(/^\//, "");
      const segments = relativePath.replace(/^uploads\//, "").split("/");
      const { resolveUploadDiskPath } = await import("@/lib/uploads");
      const diskPath = resolveUploadDiskPath(segments);
      if (diskPath) {
        const pdfBuffer = await readFile(diskPath);
        const filename = segments[segments.length - 1] ?? "invoice.pdf";
        return {
          invoiceUrl: payment.invoiceUrl,
          absoluteUrl: `${getAppUrl()}${payment.invoiceUrl}`,
          pdfBuffer,
          filename,
        };
      }
    } catch {
      // regenerate below if file missing
    }
  }

  const isLive = !!payment.liveCourseId;
  const category: UploadCategory = isLive ? "live-classes" : "record-classes";

  let courseTitle = "Course";
  if (isLive && payment.liveCourseId) {
    const [course] = await db
      .select({ title: liveCourses.title })
      .from(liveCourses)
      .where(eq(liveCourses.id, payment.liveCourseId))
      .limit(1);
    courseTitle = course?.title ?? courseTitle;
  } else if (payment.recordCourseId) {
    const [course] = await db
      .select({ title: recordCourses.title })
      .from(recordCourses)
      .where(eq(recordCourses.id, payment.recordCourseId))
      .limit(1);
    courseTitle = course?.title ?? courseTitle;
  }

  let orgName = context.orgName;
  if (!orgName && payment.organisationId) {
    const [org] = await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, payment.organisationId))
      .limit(1);
    orgName = org?.name;
  }

  const invNo = invoiceNumber(payment.id);
  const pdfBuffer = await buildInvoicePdf({
    invoiceNo: invNo,
    date: formatInvoiceDate(payment.createdAt),
    customerName: context.customerName,
    orgName,
    courseTitle,
    description: isLive ? "Live class slot purchase" : "Record class enrollment",
    quantity: payment.slotsCount,
    amount: payment.amount,
    razorpayPaymentId: payment.razorpayPaymentId,
  });

  const filename = `${invNo}.pdf`;
  const { url } = await saveUploadFile(category, filename, pdfBuffer);

  await db.update(payments).set({ invoiceUrl: url }).where(eq(payments.id, paymentId));

  return {
    invoiceUrl: url,
    absoluteUrl: `${getAppUrl()}${url}`,
    pdfBuffer,
    filename,
  };
}

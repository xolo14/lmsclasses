import PDFDocument from "pdfkit";
import type {
  TemplateLayout,
  TemplateElement,
  TextElement,
  SignatureElement,
  DividerElement,
} from "@/lib/types/certificate";

type PdfDoc = InstanceType<typeof PDFDocument>;
export type TokenData = {
  studentName: string;
  studentId: string;
  courseName: string;
  domain: string;
  orgName: string;
  certificateNumber: string;
  issueDate: string;
  completionDate: string;
  verifyUrl: string;
};

const TOKEN_MAP: Record<string, keyof TokenData> = {
  "{{studentName}}": "studentName",
  "{{studentId}}": "studentId",
  "{{courseName}}": "courseName",
  "{{domain}}": "domain",
  "{{orgName}}": "orgName",
  "{{certificateNumber}}": "certificateNumber",
  "{{issueDate}}": "issueDate",
  "{{completionDate}}": "completionDate",
  "{{verifyUrl}}": "verifyUrl",
};

export function replaceTokens(text: string, data: TokenData): string {
  let out = text;
  for (const [token, key] of Object.entries(TOKEN_MAP)) {
    out = out.split(token).join(data[key] ?? "");
  }
  return out;
}

export function resolveTokens(layout: TemplateLayout, data: TokenData): TemplateLayout {
  const cloned: TemplateLayout = JSON.parse(JSON.stringify(layout));
  cloned.elements = cloned.elements.map((el) => {
    if (el.type === "text") {
      return { ...el, content: replaceTokens(el.content, data) };
    }
    if (el.type === "signature" && el.signatureType === "text" && el.signatureText) {
      return { ...el, signatureText: replaceTokens(el.signatureText, data) };
    }
    return el;
  });
  return cloned;
}

function pdfFont(family: string, weight: "normal" | "bold", style: "normal" | "italic"): string {
  const f = family.toLowerCase();
  if (f.includes("georgia") || f.includes("playfair") || f.includes("times")) {
    if (weight === "bold" && style === "italic") return "Times-BoldItalic";
    if (weight === "bold") return "Times-Bold";
    if (style === "italic") return "Times-Italic";
    return "Times-Roman";
  }
  if (weight === "bold") return "Helvetica-Bold";
  if (style === "italic") return "Helvetica-Oblique";
  return "Helvetica";
}

function drawBackground(doc: PdfDoc, layout: TemplateLayout) {
  const { width, height, background } = layout;
  if (background.type === "color") {
    doc.rect(0, 0, width, height).fill(background.value);
  } else if (background.type === "gradient") {
    doc.rect(0, 0, width, height).fill("#0f172a");
  } else {
    doc.rect(0, 0, width, height).fill("#ffffff");
  }
}

function drawBorder(doc: PdfDoc, layout: TemplateLayout) {
  const { border, width, height } = layout;
  if (!border.show || border.style === "none") return;
  const inset = border.width;
  doc.lineWidth(border.width).strokeColor(border.color);
  if (border.style === "double") {
    doc.rect(inset, inset, width - inset * 2, height - inset * 2).stroke();
    doc.rect(inset * 2, inset * 2, width - inset * 4, height - inset * 4).stroke();
  } else {
    doc.rect(inset, inset, width - inset * 2, height - inset * 2).stroke();
  }
}

function drawTextElement(doc: PdfDoc, el: TextElement) {
  if (el.backgroundColor) {
    doc.rect(el.x, el.y, el.width, el.height).fill(el.backgroundColor);
  }
  const font = pdfFont(el.fontFamily, el.fontWeight, el.fontStyle);
  doc.font(font).fontSize(el.fontSize).fillColor(el.color);
  const lines = el.content.split("\n");
  let y = el.y;
  const lineH = el.fontSize * el.lineHeight;
  for (const line of lines) {
    const textWidth = doc.widthOfString(line);
    let x = el.x;
    if (el.textAlign === "center") x = el.x + (el.width - textWidth) / 2;
    if (el.textAlign === "right") x = el.x + el.width - textWidth;
    doc.text(line, x, y, { width: el.width, align: el.textAlign });
    y += lineH;
  }
}

function drawSignatureElement(doc: PdfDoc, el: SignatureElement) {
  const sigY = el.y + 10;
  if (el.signatureType === "text" && el.signatureText) {
    const font = pdfFont(el.signatureFont ?? "Georgia", "normal", "normal");
    doc.font(font).fontSize(el.signatureFontSize ?? 24).fillColor("#0f172a");
    doc.text(el.signatureText, el.x, sigY, { width: el.width, align: "center" });
  }
  if (el.borderBottom) {
    const lineY = sigY + (el.signatureFontSize ?? 24) + 8;
    doc
      .moveTo(el.x + 10, lineY)
      .lineTo(el.x + el.width - 10, lineY)
      .lineWidth(1.5)
      .strokeColor("#0f172a")
      .stroke();
  }
  doc
    .font("Helvetica")
    .fontSize(el.labelFontSize)
    .fillColor(el.labelColor)
    .text(el.label, el.x, el.y + el.height - el.labelFontSize - 8, {
      width: el.width,
      align: "center",
    });
}

function drawDividerElement(doc: PdfDoc, el: DividerElement) {
  const midY = el.y + el.height / 2;
  doc
    .moveTo(el.x, midY)
    .lineTo(el.x + el.width, midY)
    .lineWidth(el.thickness)
    .strokeColor(el.color)
    .stroke();
}

function drawElement(doc: PdfDoc, el: TemplateElement) {
  if (el.type === "text") drawTextElement(doc, el);
  else if (el.type === "signature") drawSignatureElement(doc, el);
  else if (el.type === "divider") drawDividerElement(doc, el);
}

export async function generateCertificatePdf(
  layout: TemplateLayout,
  resolvedTokens: TokenData
): Promise<Buffer> {
  const resolved = resolveTokens(layout, resolvedTokens);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [resolved.width, resolved.height],
      margin: 0,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawBackground(doc, resolved);
    const sorted = [...resolved.elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const el of sorted) drawElement(doc, el);
    drawBorder(doc, resolved);
    doc.end();
  });
}

// Certificates are stored on disk under uploads/certificates/ (see lib/certificate-storage.ts).

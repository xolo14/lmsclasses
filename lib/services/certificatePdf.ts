import PDFDocument from "pdfkit";
import type {
  TemplateLayout,
  TemplateElement,
  TextElement,
  SignatureElement,
  DividerElement,
} from "@/lib/types/certificate";
import { extractGradientColors, parseCssColor } from "@/lib/certificate-colors";
import { loadBackgroundImageBuffer } from "@/lib/certificate-background-image";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type TokenData = {
  studentName: string;
  lmsId: string;
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
  "{{lmsId}}": "lmsId",
  "{{studentId}}": "lmsId",
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

function normalizeLayoutBackground(layout: TemplateLayout): TemplateLayout {
  const { background } = layout;
  if (background.type === "image") {
    return layout;
  }
  const v = background.value?.trim() ?? "";
  if (background.type === "gradient" || v.includes("gradient(")) {
    return layout;
  }
  return {
    ...layout,
    background: {
      type: "color",
      value: parseCssColor(v, "#ffffff"),
      underlayColor: background.underlayColor,
    },
  };
}

function pdfFont(family: string, weight: "normal" | "bold", style: "normal" | "italic"): string {
  const f = family.toLowerCase();
  if (f.includes("georgia") || f.includes("playfair") || f.includes("times") || f.includes("serif")) {
    if (weight === "bold" && style === "italic") return "Times-BoldItalic";
    if (weight === "bold") return "Times-Bold";
    if (style === "italic") return "Times-Italic";
    return "Times-Roman";
  }
  if (weight === "bold" && style === "italic") return "Helvetica-BoldOblique";
  if (weight === "bold") return "Helvetica-Bold";
  if (style === "italic") return "Helvetica-Oblique";
  return "Helvetica";
}

function drawBackground(doc: PdfDoc, layout: TemplateLayout, bgImage: Buffer | null) {
  const { width, height, background } = layout;
  const v = background.value ?? "";

  if (background.type === "image") {
    doc.rect(0, 0, width, height).fill(parseCssColor(background.underlayColor, "#ffffff"));
    if (bgImage) {
      doc.image(bgImage, 0, 0, { width, height });
    }
    return;
  }

  if (background.type === "gradient" || v.includes("gradient(")) {
    const [c1, c2] = extractGradientColors(v);
    const grad = doc.linearGradient(0, 0, width, height);
    grad.stop(0, c1).stop(1, c2);
    doc.rect(0, 0, width, height).fill(grad);
    return;
  }

  doc.rect(0, 0, width, height).fill(parseCssColor(v, "#ffffff"));
}

function drawBorder(doc: PdfDoc, layout: TemplateLayout) {
  const { border, width, height } = layout;
  if (!border.show || border.style === "none") return;
  const inset = border.width;
  doc.lineWidth(border.width).strokeColor(parseCssColor(border.color, "#0f172a"));
  if (border.style === "double") {
    doc.rect(inset, inset, width - inset * 2, height - inset * 2).stroke();
    doc.rect(inset * 2, inset * 2, width - inset * 4, height - inset * 4).stroke();
  } else {
    doc.rect(inset, inset, width - inset * 2, height - inset * 2).stroke();
  }
}

function drawTextElement(doc: PdfDoc, el: TextElement) {
  if (el.backgroundColor) {
    doc.rect(el.x, el.y, el.width, el.height).fill(parseCssColor(el.backgroundColor));
  }

  const font = pdfFont(el.fontFamily, el.fontWeight, el.fontStyle);
  doc.font(font).fontSize(el.fontSize).fillColor(parseCssColor(el.color, "#0f172a"));

  const lines = el.content.split("\n");
  const lineH = el.fontSize * el.lineHeight;
  const blockH = lines.length * lineH;
  let y = el.y + Math.max(0, (el.height - blockH) / 2);

  for (const line of lines) {
    doc.text(line, el.x, y, {
      width: el.width,
      align: el.textAlign,
      lineBreak: false,
    });
    y += lineH;
  }
}

function drawSignatureElement(doc: PdfDoc, el: SignatureElement) {
  const sigColor = parseCssColor(el.signatureColor ?? "#0f172a");
  const sigFontSize = el.signatureFontSize ?? 24;
  const sigY = el.y + Math.max(8, (el.height - sigFontSize - el.labelFontSize - 20) / 2);

  if (el.signatureType === "text" && el.signatureText) {
    const font = pdfFont(el.signatureFont ?? "Georgia", "normal", "normal");
    doc.font(font).fontSize(sigFontSize).fillColor(sigColor);
    doc.text(el.signatureText, el.x, sigY, { width: el.width, align: "center", lineBreak: false });
  }

  if (el.borderBottom) {
    const lineY = sigY + sigFontSize + 6;
    doc
      .moveTo(el.x + el.width * 0.15, lineY)
      .lineTo(el.x + el.width * 0.85, lineY)
      .lineWidth(1.2)
      .strokeColor(sigColor)
      .stroke();
  }

  doc
    .font("Helvetica")
    .fontSize(el.labelFontSize)
    .fillColor(parseCssColor(el.labelColor, "#64748b"))
    .text(el.label, el.x, el.y + el.height - el.labelFontSize - 6, {
      width: el.width,
      align: "center",
      lineBreak: false,
    });
}

function drawDividerElement(doc: PdfDoc, el: DividerElement) {
  const midY = el.y + el.height / 2;
  doc
    .moveTo(el.x, midY)
    .lineTo(el.x + el.width, midY)
    .lineWidth(el.thickness)
    .strokeColor(parseCssColor(el.color, "#cbd5e1"))
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
  const normalized = normalizeLayoutBackground(layout);
  const resolved = resolveTokens(normalized, resolvedTokens);
  const bgImage =
    resolved.background.type === "image" && resolved.background.value
      ? await loadBackgroundImageBuffer(resolved.background.value)
      : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [resolved.width, resolved.height],
      margin: 0,
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawBackground(doc, resolved, bgImage);
    const sorted = [...resolved.elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const el of sorted) drawElement(doc, el);
    drawBorder(doc, resolved);
    doc.end();
  });
}

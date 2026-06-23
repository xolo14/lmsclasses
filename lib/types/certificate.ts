export interface TemplateLayout {
  width: number;
  height: number;
  background: {
    type: "color" | "gradient" | "image";
    value: string;
    /** Color behind background image (letterbox/fallback). */
    underlayColor?: string;
  };
  border: {
    show: boolean;
    style: "none" | "single" | "double" | "ornate";
    color: string;
    width: number;
  };
  elements: TemplateElement[];
}

export type TemplateElement =
  | TextElement
  | ImageElement
  | SignatureElement
  | DividerElement;

interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
}

export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  color: string;
  backgroundColor?: string;
  textAlign: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;
  objectFit: "contain" | "cover";
  opacity: number;
  borderRadius: number;
}

export interface SignatureElement extends BaseElement {
  type: "signature";
  label: string;
  signatureType: "image" | "text";
  imageSrc?: string;
  signatureText?: string;
  signatureFont?: string;
  signatureFontSize?: number;
  borderBottom: boolean;
  labelFontSize: number;
  labelColor: string;
  signatureColor?: string;
}

export interface DividerElement extends BaseElement {
  type: "divider";
  style: "solid" | "dashed" | "dotted" | "ornate";
  color: string;
  thickness: number;
}

export const CERTIFICATE_TOKENS = [
  "{{studentName}}",
  "{{lmsId}}",
  "{{courseName}}",
  "{{domain}}",
  "{{orgName}}",
  "{{certificateNumber}}",
  "{{issueDate}}",
  "{{completionDate}}",
  "{{verifyUrl}}",
] as const;

export const DEFAULT_LAYOUT_SIZE = { width: 1123, height: 794 };

export function createEmptyLayout(): TemplateLayout {
  return {
    width: DEFAULT_LAYOUT_SIZE.width,
    height: DEFAULT_LAYOUT_SIZE.height,
    background: { type: "color", value: "#ffffff" },
    border: { show: true, style: "double", color: "#0f172a", width: 4 },
    elements: [],
  };
}

export function createClassicPreset(): TemplateLayout {
  return {
    width: DEFAULT_LAYOUT_SIZE.width,
    height: DEFAULT_LAYOUT_SIZE.height,
    background: { type: "color", value: "#fdfbf7" },
    border: { show: true, style: "double", color: "#1e3a5f", width: 8 },
    elements: [
      {
        id: "org",
        type: "text",
        x: 80,
        y: 48,
        width: 963,
        height: 32,
        zIndex: 1,
        locked: false,
        content: "{{orgName}}",
        fontFamily: "Georgia",
        fontSize: 14,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 3,
        lineHeight: 1.2,
      },
      {
        id: "title",
        type: "text",
        x: 80,
        y: 88,
        width: 963,
        height: 56,
        zIndex: 2,
        locked: false,
        content: "CERTIFICATE OF COMPLETION",
        fontFamily: "Georgia",
        fontSize: 40,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#1e3a5f",
        textAlign: "center",
        letterSpacing: 4,
        lineHeight: 1.2,
      },
      {
        id: "subtitle",
        type: "text",
        x: 180,
        y: 158,
        width: 763,
        height: 36,
        zIndex: 3,
        locked: false,
        content: "This is to certify that",
        fontFamily: "Georgia",
        fontSize: 18,
        fontWeight: "normal",
        fontStyle: "italic",
        color: "#475569",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
      {
        id: "student",
        type: "text",
        x: 80,
        y: 210,
        width: 963,
        height: 72,
        zIndex: 4,
        locked: false,
        content: "{{studentName}}",
        fontFamily: "Georgia",
        fontSize: 46,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 1,
        lineHeight: 1.2,
      },
      {
        id: "divider-1",
        type: "divider",
        x: 362,
        y: 298,
        width: 400,
        height: 8,
        zIndex: 5,
        locked: false,
        style: "solid",
        color: "#c9a227",
        thickness: 2,
      },
      {
        id: "course-line",
        type: "text",
        x: 120,
        y: 320,
        width: 883,
        height: 88,
        zIndex: 6,
        locked: false,
        content: "has successfully completed\n{{courseName}}",
        fontFamily: "Georgia",
        fontSize: 22,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#334155",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.5,
      },
      {
        id: "domain",
        type: "text",
        x: 120,
        y: 410,
        width: 883,
        height: 32,
        zIndex: 7,
        locked: false,
        content: "Domain: {{domain}}",
        fontFamily: "Helvetica",
        fontSize: 14,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
      {
        id: "meta",
        type: "text",
        x: 80,
        y: 460,
        width: 963,
        height: 48,
        zIndex: 8,
        locked: false,
        content: "Certificate No: {{certificateNumber}}\nLMS ID: {{lmsId}}  ·  Issued: {{issueDate}}",
        fontFamily: "Helvetica",
        fontSize: 12,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.5,
      },
      {
        id: "sig-left",
        type: "signature",
        x: 120,
        y: 580,
        width: 260,
        height: 100,
        zIndex: 9,
        locked: false,
        label: "Program Director",
        signatureType: "text",
        signatureText: "{{orgName}}",
        signatureFont: "Georgia",
        signatureFontSize: 22,
        signatureColor: "#1e3a5f",
        borderBottom: true,
        labelFontSize: 11,
        labelColor: "#64748b",
      },
      {
        id: "sig-right",
        type: "signature",
        x: 743,
        y: 580,
        width: 260,
        height: 100,
        zIndex: 10,
        locked: false,
        label: "Authorised Signatory",
        signatureType: "text",
        signatureText: "LMS Classes",
        signatureFont: "Georgia",
        signatureFontSize: 22,
        signatureColor: "#1e3a5f",
        borderBottom: true,
        labelFontSize: 11,
        labelColor: "#64748b",
      },
    ],
  };
}

export function createModernPreset(): TemplateLayout {
  return {
    width: DEFAULT_LAYOUT_SIZE.width,
    height: DEFAULT_LAYOUT_SIZE.height,
    background: { type: "color", value: "#ffffff" },
    border: { show: true, style: "single", color: "#0891b2", width: 4 },
    elements: [
      {
        id: "accent-bar",
        type: "divider",
        x: 0,
        y: 0,
        width: 1123,
        height: 12,
        zIndex: 1,
        locked: false,
        style: "solid",
        color: "#0891b2",
        thickness: 12,
      },
      {
        id: "title",
        type: "text",
        x: 80,
        y: 72,
        width: 963,
        height: 52,
        zIndex: 2,
        locked: false,
        content: "CERTIFICATE OF ACHIEVEMENT",
        fontFamily: "Helvetica",
        fontSize: 34,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 5,
        lineHeight: 1.2,
      },
      {
        id: "title-line",
        type: "divider",
        x: 412,
        y: 132,
        width: 300,
        height: 4,
        zIndex: 3,
        locked: false,
        style: "solid",
        color: "#0891b2",
        thickness: 3,
      },
      {
        id: "subtitle",
        type: "text",
        x: 160,
        y: 152,
        width: 803,
        height: 32,
        zIndex: 4,
        locked: false,
        content: "PROUDLY PRESENTED TO",
        fontFamily: "Helvetica",
        fontSize: 13,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 4,
        lineHeight: 1.4,
      },
      {
        id: "student",
        type: "text",
        x: 80,
        y: 198,
        width: 963,
        height: 68,
        zIndex: 5,
        locked: false,
        content: "{{studentName}}",
        fontFamily: "Georgia",
        fontSize: 44,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 1,
        lineHeight: 1.2,
      },
      {
        id: "course-intro",
        type: "text",
        x: 160,
        y: 286,
        width: 803,
        height: 28,
        zIndex: 6,
        locked: false,
        content: "for successful completion of",
        fontFamily: "Helvetica",
        fontSize: 16,
        fontWeight: "normal",
        fontStyle: "italic",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
      {
        id: "course",
        type: "text",
        x: 120,
        y: 318,
        width: 883,
        height: 56,
        zIndex: 7,
        locked: false,
        content: "{{courseName}}",
        fontFamily: "Helvetica",
        fontSize: 26,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0891b2",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.3,
      },
      {
        id: "meta",
        type: "text",
        x: 80,
        y: 400,
        width: 963,
        height: 44,
        zIndex: 8,
        locked: false,
        content: "{{certificateNumber}}  ·  LMS ID: {{lmsId}}  ·  {{issueDate}}",
        fontFamily: "Helvetica",
        fontSize: 12,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#94a3b8",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.5,
      },
      {
        id: "sig",
        type: "signature",
        x: 432,
        y: 560,
        width: 260,
        height: 100,
        zIndex: 9,
        locked: false,
        label: "Authorised Signatory",
        signatureType: "text",
        signatureText: "{{orgName}}",
        signatureFont: "Georgia",
        signatureFontSize: 24,
        signatureColor: "#0f172a",
        borderBottom: true,
        labelFontSize: 11,
        labelColor: "#64748b",
      },
    ],
  };
}

export function createMinimalPreset(): TemplateLayout {
  return {
    width: DEFAULT_LAYOUT_SIZE.width,
    height: DEFAULT_LAYOUT_SIZE.height,
    background: { type: "color", value: "#ffffff" },
    border: { show: true, style: "single", color: "#e2e8f0", width: 2 },
    elements: [
      {
        id: "title",
        type: "text",
        x: 80,
        y: 80,
        width: 963,
        height: 44,
        zIndex: 1,
        locked: false,
        content: "Certificate of Completion",
        fontFamily: "Helvetica",
        fontSize: 28,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 1,
        lineHeight: 1.2,
      },
      {
        id: "student",
        type: "text",
        x: 80,
        y: 200,
        width: 963,
        height: 60,
        zIndex: 2,
        locked: false,
        content: "{{studentName}}",
        fontFamily: "Georgia",
        fontSize: 38,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.2,
      },
      {
        id: "course",
        type: "text",
        x: 120,
        y: 280,
        width: 883,
        height: 72,
        zIndex: 3,
        locked: false,
        content: "Completed {{courseName}} on {{completionDate}}",
        fontFamily: "Helvetica",
        fontSize: 18,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.5,
      },
      {
        id: "meta",
        type: "text",
        x: 80,
        y: 620,
        width: 963,
        height: 40,
        zIndex: 4,
        locked: false,
        content: "{{certificateNumber}}  ·  LMS ID: {{lmsId}}",
        fontFamily: "Helvetica",
        fontSize: 11,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#94a3b8",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
    ],
  };
}

export const CERTIFICATE_PRESETS = [
  { id: "classic", name: "Classic", layout: createClassicPreset },
  { id: "modern", name: "Modern", layout: createModernPreset },
  { id: "minimal", name: "Minimal", layout: createMinimalPreset },
] as const;

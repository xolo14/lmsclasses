export interface TemplateLayout {
  width: number;
  height: number;
  background: {
    type: "color" | "gradient" | "image";
    value: string;
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
}

export interface DividerElement extends BaseElement {
  type: "divider";
  style: "solid" | "dashed" | "dotted" | "ornate";
  color: string;
  thickness: number;
}

export const CERTIFICATE_TOKENS = [
  "{{studentName}}",
  "{{studentId}}",
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
    ...createEmptyLayout(),
    background: { type: "color", value: "#fafaf9" },
    border: { show: true, style: "double", color: "#0f172a", width: 6 },
    elements: [
      {
        id: "title",
        type: "text",
        x: 120,
        y: 80,
        width: 880,
        height: 60,
        zIndex: 1,
        locked: false,
        content: "Certificate of Completion",
        fontFamily: "Georgia",
        fontSize: 42,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 2,
        lineHeight: 1.2,
      },
      {
        id: "subtitle",
        type: "text",
        x: 200,
        y: 160,
        width: 720,
        height: 40,
        zIndex: 2,
        locked: false,
        content: "This is to certify that",
        fontFamily: "Inter",
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
        x: 120,
        y: 220,
        width: 880,
        height: 70,
        zIndex: 3,
        locked: false,
        content: "{{studentName}}",
        fontFamily: "Georgia",
        fontSize: 48,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "center",
        letterSpacing: 1,
        lineHeight: 1.2,
      },
      {
        id: "course-line",
        type: "text",
        x: 140,
        y: 320,
        width: 840,
        height: 80,
        zIndex: 4,
        locked: false,
        content: "has successfully completed the course\n{{courseName}}",
        fontFamily: "Inter",
        fontSize: 22,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#334155",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.5,
      },
      {
        id: "meta",
        type: "text",
        x: 140,
        y: 430,
        width: 840,
        height: 60,
        zIndex: 5,
        locked: false,
        content: "Certificate No: {{certificateNumber}}  |  Issued: {{issueDate}}",
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
      {
        id: "sig",
        type: "signature",
        x: 780,
        y: 560,
        width: 220,
        height: 100,
        zIndex: 6,
        locked: false,
        label: "Authorised Signatory",
        signatureType: "text",
        signatureText: "LMS Classes",
        signatureFont: "Georgia",
        signatureFontSize: 28,
        borderBottom: true,
        labelFontSize: 12,
        labelColor: "#64748b",
      },
    ],
  };
}

export function createModernPreset(): TemplateLayout {
  return {
    ...createEmptyLayout(),
    background: { type: "gradient", value: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" },
    border: { show: true, style: "single", color: "#06b6d4", width: 3 },
    elements: [
      {
        id: "title",
        type: "text",
        x: 100,
        y: 70,
        width: 920,
        height: 55,
        zIndex: 1,
        locked: false,
        content: "CERTIFICATE OF ACHIEVEMENT",
        fontFamily: "Montserrat",
        fontSize: 36,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#06b6d4",
        textAlign: "center",
        letterSpacing: 4,
        lineHeight: 1.2,
      },
      {
        id: "student",
        type: "text",
        x: 100,
        y: 200,
        width: 920,
        height: 70,
        zIndex: 2,
        locked: false,
        content: "{{studentName}}",
        fontFamily: "Montserrat",
        fontSize: 44,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#f8fafc",
        textAlign: "center",
        letterSpacing: 1,
        lineHeight: 1.2,
      },
      {
        id: "course",
        type: "text",
        x: 140,
        y: 300,
        width: 840,
        height: 70,
        zIndex: 3,
        locked: false,
        content: "{{courseName}}",
        fontFamily: "Montserrat",
        fontSize: 24,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#94a3b8",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
      {
        id: "meta",
        type: "text",
        x: 140,
        y: 400,
        width: 840,
        height: 50,
        zIndex: 4,
        locked: false,
        content: "{{certificateNumber}} · {{issueDate}}",
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "center",
        letterSpacing: 0,
        lineHeight: 1.4,
      },
    ],
  };
}

export function createMinimalPreset(): TemplateLayout {
  return {
    ...createEmptyLayout(),
    background: { type: "color", value: "#ffffff" },
    border: { show: true, style: "single", color: "#cbd5e1", width: 2 },
    elements: [
      {
        id: "title",
        type: "text",
        x: 80,
        y: 100,
        width: 500,
        height: 50,
        zIndex: 1,
        locked: false,
        content: "Certificate",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "left",
        letterSpacing: 0,
        lineHeight: 1.2,
      },
      {
        id: "student",
        type: "text",
        x: 80,
        y: 200,
        width: 600,
        height: 60,
        zIndex: 2,
        locked: false,
        content: "{{studentName}}",
        fontFamily: "Inter",
        fontSize: 36,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#0f172a",
        textAlign: "left",
        letterSpacing: 0,
        lineHeight: 1.2,
      },
      {
        id: "course",
        type: "text",
        x: 80,
        y: 280,
        width: 700,
        height: 80,
        zIndex: 3,
        locked: false,
        content: "Completed {{courseName}} on {{completionDate}}",
        fontFamily: "Inter",
        fontSize: 18,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#64748b",
        textAlign: "left",
        letterSpacing: 0,
        lineHeight: 1.5,
      },
      {
        id: "cert-no",
        type: "text",
        x: 80,
        y: 620,
        width: 400,
        height: 30,
        zIndex: 4,
        locked: false,
        content: "{{certificateNumber}}",
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#94a3b8",
        textAlign: "left",
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

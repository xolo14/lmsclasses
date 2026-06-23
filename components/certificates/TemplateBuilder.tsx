"use client";

import { useReducer, useRef, useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TemplateElement, TemplateLayout, TextElement } from "@/lib/types/certificate";
import { CERTIFICATE_TOKENS, DEFAULT_LAYOUT_SIZE } from "@/lib/types/certificate";
import { createTemplateAction, updateTemplateAction } from "@/lib/actions/certificate";

type BuilderState = {
  layout: TemplateLayout;
  selectedId: string | null;
  name: string;
  courseId: string;
  courseType: "" | "live" | "record";
  autoIssue: boolean;
  isDefault: boolean;
};

type Action =
  | { type: "SET_FIELD"; field: keyof Omit<BuilderState, "layout" | "selectedId">; value: unknown }
  | { type: "SET_LAYOUT"; layout: TemplateLayout }
  | { type: "SELECT"; id: string | null }
  | { type: "UPDATE_ELEMENT"; id: string; patch: Partial<TemplateElement> }
  | { type: "ADD_ELEMENT"; element: TemplateElement }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "MOVE"; id: string; x: number; y: number };

function reducer(state: BuilderState, action: Action): BuilderState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_LAYOUT":
      return { ...state, layout: action.layout };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "UPDATE_ELEMENT":
      return {
        ...state,
        layout: {
          ...state.layout,
          elements: state.layout.elements.map((el) =>
            el.id === action.id ? ({ ...el, ...action.patch } as TemplateElement) : el
          ),
        },
      };
    case "ADD_ELEMENT":
      return {
        ...state,
        layout: { ...state.layout, elements: [...state.layout.elements, action.element] },
        selectedId: action.element.id,
      };
    case "DELETE_ELEMENT":
      return {
        ...state,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        layout: {
          ...state.layout,
          elements: state.layout.elements.filter((el) => el.id !== action.id),
        },
      };
    case "MOVE":
      return {
        ...state,
        layout: {
          ...state.layout,
          elements: state.layout.elements.map((el) =>
            el.id === action.id ? { ...el, x: action.x, y: action.y } : el
          ),
        },
      };
    default:
      return state;
  }
}

function newTextElement(): TextElement {
  return {
    id: nanoid(),
    type: "text",
    x: 100,
    y: 100,
    width: 400,
    height: 48,
    zIndex: stateZIndex(),
    locked: false,
    content: "New text — use {{studentName}} tokens",
    fontFamily: "Inter",
    fontSize: 20,
    fontWeight: "normal",
    fontStyle: "normal",
    color: "#0f172a",
    textAlign: "left",
    letterSpacing: 0,
    lineHeight: 1.4,
  };
}

let zCounter = 10;
function stateZIndex() {
  return zCounter++;
}

type CourseOption = { id: string; title: string; type: "live" | "record" };

export function TemplateBuilder({
  portal,
  initial,
  templateId,
}: {
  portal: "super-admin" | "org-admin";
  initial?: {
    name: string;
    layout: TemplateLayout;
    courseId?: string | null;
    courseType?: "live" | "record" | null;
    autoIssue: boolean;
    isDefault: boolean;
  };
  templateId?: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const [state, dispatch] = useReducer(reducer, {
    layout: initial?.layout ?? {
      width: DEFAULT_LAYOUT_SIZE.width,
      height: DEFAULT_LAYOUT_SIZE.height,
      background: { type: "color", value: "#ffffff" },
      border: { show: true, style: "double", color: "#0f172a", width: 4 },
      elements: [],
    },
    selectedId: null,
    name: initial?.name ?? "",
    courseId: initial?.courseId ?? "",
    courseType: initial?.courseType ?? "",
    autoIssue: initial?.autoIssue ?? false,
    isDefault: initial?.isDefault ?? false,
  });

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    const [live, record] = await Promise.all([
      fetch("/api/live-courses").then((r) => r.json()),
      fetch("/api/record-courses").then((r) => r.json()),
    ]);
    const opts: CourseOption[] = [
      ...(Array.isArray(live) ? live : []).map((c: { id: string; title: string }) => ({
        id: c.id,
        title: c.title,
        type: "live" as const,
      })),
      ...(Array.isArray(record) ? record : []).map((c: { id: string; title: string }) => ({
        id: c.id,
        title: c.title,
        type: "record" as const,
      })),
    ];
    setCourses(opts);
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const selected = state.layout.elements.find((el) => el.id === state.selectedId);

  const scale = 0.55;

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      name: state.name,
      layout: state.layout,
      courseId: state.courseId || undefined,
      courseType: state.courseType || undefined,
      autoIssue: state.autoIssue,
      isDefault: state.isDefault,
    };
    const res = templateId
      ? await updateTemplateAction(templateId, payload)
      : await createTemplateAction(payload);
    setSaving(false);
    if (!res.success) {
      setError(typeof res.error === "string" ? res.error : "Save failed");
      return;
    }
    router.push(`/${portal}/certificates`);
    router.refresh();
  };

  const onCanvasMouseDown = (e: React.MouseEvent, el: TemplateElement) => {
    if (el.locked) return;
    e.stopPropagation();
    dispatch({ type: "SELECT", id: el.id });
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      id: el.id,
      ox: e.clientX / scale - el.x,
      oy: e.clientY / scale - el.y,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(0, e.clientX / scale - dragRef.current.ox);
    const y = Math.max(0, e.clientY / scale - dragRef.current.oy);
    dispatch({ type: "MOVE", id: dragRef.current.id, x, y });
  };

  const onMouseUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${portal}/certificates`}>← Back</Link>
          </Button>
          <h1 className="text-xl font-bold">Certificate Template Builder</h1>
        </div>
        <Button onClick={onSave} disabled={saving || !state.name.trim()}>
          {saving ? "Saving..." : "Save Template"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label>Template name</Label>
            <Input value={state.name} onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Course (optional)</Label>
            <Select
              value={state.courseId ? `${state.courseType}:${state.courseId}` : "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  dispatch({ type: "SET_FIELD", field: "courseId", value: "" });
                  dispatch({ type: "SET_FIELD", field: "courseType", value: "" });
                } else {
                  const [type, id] = v.split(":");
                  dispatch({ type: "SET_FIELD", field: "courseId", value: id });
                  dispatch({ type: "SET_FIELD", field: "courseType", value: type });
                }
              }}
              onOpenChange={(open) => open && courses.length === 0 && void loadCourses()}
            >
              <SelectTrigger><SelectValue placeholder="General template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General (any course)</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>
                    [{c.type}] {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.autoIssue}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "autoIssue", value: e.target.checked })}
            />
            Auto-issue at 100% completion
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.isDefault}
              onChange={(e) => dispatch({ type: "SET_FIELD", field: "isDefault", value: e.target.checked })}
            />
            Default for course
          </label>
          <div className="space-y-2 border-t border-border pt-3">
            <Label>Add elements</Label>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => dispatch({ type: "ADD_ELEMENT", element: newTextElement() })}>
              + Text
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() =>
                dispatch({
                  type: "ADD_ELEMENT",
                  element: {
                    id: nanoid(),
                    type: "signature",
                    x: 400,
                    y: 520,
                    width: 220,
                    height: 100,
                    zIndex: stateZIndex(),
                    locked: false,
                    label: "Authorised Signatory",
                    signatureType: "text",
                    signatureText: "LMS Classes",
                    signatureFont: "Georgia",
                    signatureFontSize: 24,
                    borderBottom: true,
                    labelFontSize: 12,
                    labelColor: "#64748b",
                  },
                })
              }
            >
              + Signature
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <Label>Background</Label>
            <Input
              value={state.layout.background.value}
              onChange={(e) =>
                dispatch({
                  type: "SET_LAYOUT",
                  layout: { ...state.layout, background: { type: "color", value: e.target.value } },
                })
              }
            />
          </div>
        </div>

        <div
          className="overflow-auto rounded-lg border border-border bg-muted/30 p-4"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div
            ref={canvasRef}
            className="relative mx-auto shadow-lg"
            style={{
              width: state.layout.width * scale,
              height: state.layout.height * scale,
              background: state.layout.background.value,
              border: state.layout.border.show
                ? `${state.layout.border.width}px ${state.layout.border.style === "double" ? "double" : "solid"} ${state.layout.border.color}`
                : undefined,
            }}
            onClick={() => dispatch({ type: "SELECT", id: null })}
          >
            {[...state.layout.elements]
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((el) => (
                <div
                  key={el.id}
                  onMouseDown={(e) => onCanvasMouseDown(e, el)}
                  className={`absolute cursor-move select-none ${
                    state.selectedId === el.id ? "ring-2 ring-cyan-500 ring-offset-1" : ""
                  }`}
                  style={{
                    left: el.x * scale,
                    top: el.y * scale,
                    width: el.width * scale,
                    height: el.height * scale,
                    zIndex: el.zIndex,
                  }}
                >
                  {el.type === "text" && (
                    <div
                      style={{
                        fontFamily: el.fontFamily,
                        fontSize: el.fontSize * scale,
                        fontWeight: el.fontWeight,
                        fontStyle: el.fontStyle,
                        color: el.color,
                        textAlign: el.textAlign,
                        lineHeight: el.lineHeight,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {el.content}
                    </div>
                  )}
                  {el.type === "signature" && (
                    <div className="flex h-full flex-col items-center justify-end text-center">
                      <span style={{ fontFamily: el.signatureFont, fontSize: (el.signatureFontSize ?? 20) * scale }}>
                        {el.signatureText}
                      </span>
                      {el.borderBottom && <div className="my-1 h-px w-4/5 bg-slate-800" />}
                      <span style={{ fontSize: el.labelFontSize * scale, color: el.labelColor }}>{el.label}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h3 className="font-semibold">Element Inspector</h3>
          {!selected && <p className="text-sm text-muted-foreground">Select an element on the canvas</p>}
          {selected?.type === "text" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Content</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selected.content}
                  onChange={(e) => dispatch({ type: "UPDATE_ELEMENT", id: selected.id, patch: { content: e.target.value } })}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {CERTIFICATE_TOKENS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded bg-muted px-2 py-0.5 text-xs"
                    onClick={() =>
                      dispatch({
                        type: "UPDATE_ELEMENT",
                        id: selected.id,
                        patch: { content: selected.content + " " + t },
                      })
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Font size</Label>
                  <Input
                    type="number"
                    value={selected.fontSize}
                    onChange={(e) =>
                      dispatch({ type: "UPDATE_ELEMENT", id: selected.id, patch: { fontSize: Number(e.target.value) } })
                    }
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    value={selected.color}
                    onChange={(e) => dispatch({ type: "UPDATE_ELEMENT", id: selected.id, patch: { color: e.target.value } })}
                  />
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => dispatch({ type: "DELETE_ELEMENT", id: selected.id })}>
                Delete element
              </Button>
            </div>
          )}
          {selected?.type === "signature" && (
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={selected.label}
                onChange={(e) => dispatch({ type: "UPDATE_ELEMENT", id: selected.id, patch: { label: e.target.value } })}
              />
              <Label>Signature text</Label>
              <Input
                value={selected.signatureText ?? ""}
                onChange={(e) => dispatch({ type: "UPDATE_ELEMENT", id: selected.id, patch: { signatureText: e.target.value } })}
              />
              <Button variant="destructive" size="sm" onClick={() => dispatch({ type: "DELETE_ELEMENT", id: selected.id })}>
                Delete element
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

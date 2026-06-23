"use client";

import { useSearchParams } from "next/navigation";
import { PresetPicker } from "@/components/certificates/PresetPicker";
import { TemplateBuilder } from "@/components/certificates/TemplateBuilder";
import {
  createClassicPreset,
  createModernPreset,
  createMinimalPreset,
  createEmptyLayout,
} from "@/lib/types/certificate";

export default function NewTemplatePage() {
  const searchParams = useSearchParams();
  const preset = searchParams.get("preset");

  if (!preset) {
    return <PresetPicker portal="org-admin" />;
  }

  const layout =
    preset === "classic"
      ? createClassicPreset()
      : preset === "modern"
        ? createModernPreset()
        : preset === "minimal"
          ? createMinimalPreset()
          : createEmptyLayout();

  return (
    <TemplateBuilder
      portal="org-admin"
      initial={{
        name: "",
        layout,
        autoIssue: false,
        isDefault: false,
      }}
    />
  );
}

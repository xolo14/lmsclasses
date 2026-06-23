"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TemplateBuilder } from "@/components/certificates/TemplateBuilder";
import type { TemplateLayout } from "@/lib/types/certificate";

export default function EditTemplatePage() {
  const params = useParams();
  const id = params.id as string;
  const [initial, setInitial] = useState<{
    name: string;
    layout: TemplateLayout;
    courseId?: string | null;
    courseType?: "live" | "record" | null;
    autoIssue: boolean;
    isDefault: boolean;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/certificates/templates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.layout) {
          setInitial({
            name: data.name,
            layout: data.layout,
            courseId: data.courseId,
            courseType: data.courseType,
            autoIssue: data.autoIssue,
            isDefault: data.isDefault,
          });
        }
      });
  }, [id]);

  if (!initial) return <p className="text-muted-foreground p-6">Loading template...</p>;

  return <TemplateBuilder portal="org-admin" templateId={id} initial={initial} />;
}

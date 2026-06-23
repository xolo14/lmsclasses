"use client";

import Link from "next/link";
import { CERTIFICATE_PRESETS } from "@/lib/types/certificate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PresetPicker({ portal }: { portal: "super-admin" | "org-admin" }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${portal}/certificates`}>← Back</Link>
        </Button>
        <h1 className="text-xl font-bold">New Certificate Template</h1>
      </div>
      <p className="text-muted-foreground">Start from a preset or build from scratch.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {CERTIFICATE_PRESETS.map((p) => (
          <Card key={p.id} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link
                  href={`/${portal}/certificates/templates/new?preset=${p.id}`}
                >
                  Use {p.name}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Blank</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" asChild className="w-full">
              <Link href={`/${portal}/certificates/templates/new?preset=blank`}>Start from scratch</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SESSION_KEY = "lms-course-viewer";

function getStoredViewer(): { name: string; phone: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { name?: string; phone?: string };
    if (parsed?.name && parsed?.phone) return { name: parsed.name, phone: parsed.phone };
  } catch {
    // ignore
  }
  return null;
}

export function useViewCourse(slug: string) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const requestView = () => {
    if (getStoredViewer()) {
      router.push(`/courses/${slug}`);
      return;
    }
    setOpen(true);
  };

  return { open, setOpen, requestView };
}

export function ViewCourseDialog({
  open,
  onOpenChange,
  slug,
  courseTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  courseTitle: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const digits = phone.trim().replace(/\D/g, "");

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ name: trimmedName, phone: digits })
    );

    try {
      const res = await fetch("/api/public/course-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: digits,
          courseSlug: slug,
          courseTitle,
        }),
      });
      if (!res.ok) {
        console.warn("[view-course] lead save failed:", res.status);
      }
    } catch {
      // navigation should still proceed if lead save fails
    }

    setError("");
    onOpenChange(false);
    router.push(`/courses/${slug}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader>
          <DialogTitle>View course</DialogTitle>
          <DialogDescription>
            Enter your details to continue to <span className="font-medium text-foreground">{courseTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="view-course-name">Name</Label>
            <Input
              id="view-course-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="view-course-phone">Phone number</Label>
            <Input
              id="view-course-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              autoComplete="tel"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Continue</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

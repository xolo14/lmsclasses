"use client";

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

interface SlotExceededModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  totalSlots: number;
}

export function SlotExceededModal({
  open,
  onOpenChange,
  courseName,
  totalSlots,
}: SlotExceededModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Slot Limit Reached</DialogTitle>
          <DialogDescription>
            You&apos;ve used all {totalSlots} slots for {courseName}. Purchase more slots to add students.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => router.push("/org-admin/courses")}>Buy More Slots</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

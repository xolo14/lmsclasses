"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchSchema, type BatchInput } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

interface AddBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCourseId?: string;
  orgAdminMode?: boolean;
}

export function AddBatchModal({ open, onOpenChange, defaultCourseId, orgAdminMode }: AddBatchModalProps) {
  const queryClient = useQueryClient();

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetch("/api/courses").then((r) => r.json()),
    enabled: open,
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ["organisations"],
    queryFn: () => fetch("/api/organisations").then((r) => r.json()),
    enabled: open && !orgAdminMode,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<BatchInput>({
    resolver: zodResolver(batchSchema),
    defaultValues: { maxSlots: 30, courseId: defaultCourseId },
  });

  useEffect(() => {
    if (defaultCourseId) setValue("courseId", defaultCourseId);
  }, [defaultCourseId, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: BatchInput) => {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create batch");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      reset();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Batch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Batch Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          {!defaultCourseId && (
            <div className="space-y-2">
              <Label>Course</Label>
              <Select onValueChange={(v) => setValue("courseId", v)} value={watch("courseId")}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: { id: string; title: string }) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!orgAdminMode && (
            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select onValueChange={(v) => setValue("organisationId", v)}>
                <SelectTrigger><SelectValue placeholder="Select organisation" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o: { id: string; name: string }) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" {...register("endDate")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Max Slots</Label>
            <Input type="number" {...register("maxSlots")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

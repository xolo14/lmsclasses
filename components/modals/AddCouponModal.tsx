"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { couponSchema, type CouponInput } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddCouponModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCouponModal({ open, onOpenChange }: AddCouponModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");

  const { data: orgs = [] } = useQuery<any[]>({
    queryKey: ["organisations"],
    queryFn: () => fetch("/api/organisations").then((r) => r.json()),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CouponInput>({
    resolver: zodResolver(couponSchema),
    defaultValues: {
      code: "",
      description: "",
      discountType: "percent",
      discountValue: undefined,
      minOrderAmount: undefined,
      maxUses: undefined,
      startsAt: "",
      expiresAt: "",
      organisationId: undefined,
      isActive: true,
    },
  });

  const discountType = watch("discountType");

  useEffect(() => {
    if (open) {
      reset({
        code: "",
        description: "",
        discountType: "percent",
        discountValue: undefined,
        minOrderAmount: undefined,
        maxUses: undefined,
        startsAt: "",
        expiresAt: "",
        organisationId: undefined,
        isActive: true,
      });
      setError("");
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CouponInput) => {
      const res = await fetch("/api/super-admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to create coupon");
      }
      return resJson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      onOpenChange(false);
    },
    onError: (err: any) => setError(err?.message || "Failed to create coupon"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Coupon</DialogTitle>
          <DialogDescription>Create a discount coupon for slot purchases.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" {...register("code")} placeholder="e.g. SUMMER25" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (internal)</Label>
            <Input id="description" {...register("description")} placeholder="e.g. Launch promo" />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discountType">Type</Label>
              <select
                id="discountType"
                {...register("discountType")}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed (₹)</option>
              </select>
              {errors.discountType && <p className="text-xs text-destructive">{errors.discountType.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountValue">Value</Label>
              <Input
                id="discountValue"
                type="number"
                step="any"
                {...register("discountValue")}
                placeholder={discountType === "percent" ? "10" : "500"}
              />
              {errors.discountValue && <p className="text-xs text-destructive">{errors.discountValue.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minOrderAmount">Min order (₹)</Label>
              <Input id="minOrderAmount" type="number" step="any" {...register("minOrderAmount")} />
              {errors.minOrderAmount && <p className="text-xs text-destructive">{errors.minOrderAmount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUses">Max uses (blank = unlimited)</Label>
              <Input id="maxUses" type="number" {...register("maxUses")} placeholder="e.g. 100" />
              {errors.maxUses && <p className="text-xs text-destructive">{errors.maxUses.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startsAt">Starts at</Label>
              <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires at</Label>
              <Input id="expiresAt" type="datetime-local" {...register("expiresAt")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisationId">Assign to organization (optional)</Label>
            <select
              id="organisationId"
              {...register("organisationId")}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">— Not assigned (public coupon) —</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">Assigned coupons appear on that organisation admin&apos;s dashboard.</p>
            {errors.organisationId && <p className="text-xs text-destructive">{errors.organisationId.message}</p>}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              id="isActive"
              type="checkbox"
              {...register("isActive")}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
          </div>

          {error && <p className="text-xs text-destructive text-center">{error}</p>}
          
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

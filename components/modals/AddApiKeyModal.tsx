"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import {
  createApiKeySchema,
  type CreateApiKeyInput,
} from "@/lib/validations/api-key";
import { API_PERMISSIONS } from "@/lib/api-key-service";
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

interface AddApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GeneratedKey = {
  key: string;
  keyId: string;
  name: string;
  permissions: string[];
  expiresAt: string | null;
};

export function AddApiKeyModal({ open, onOpenChange }: AddApiKeyModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } =
    useForm<CreateApiKeyInput>({
      resolver: zodResolver(createApiKeySchema),
      defaultValues: {
        name: "",
        permissions: ["submit_lead"],
        expiresAt: null,
      },
    });

  const selectedPermissions = watch("permissions") ?? [];

  useEffect(() => {
    if (open) {
      reset({ name: "", permissions: ["submit_lead"], expiresAt: null });
      setError("");
      setGenerated(null);
      setCopied(false);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (data: CreateApiKeyInput) => {
      const res = await fetch("/api/super-admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          expiresAt: data.expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate key");
      return json as GeneratedKey;
    },
    onSuccess: (data) => {
      setGenerated(data);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const togglePermission = (perm: (typeof API_PERMISSIONS)[number]) => {
    const next = selectedPermissions.includes(perm)
      ? selectedPermissions.filter((p) => p !== perm)
      : [...selectedPermissions, perm];
    setValue("permissions", next as CreateApiKeyInput["permissions"], { shouldValidate: true });
  };

  const copyKey = async () => {
    if (!generated?.key) return;
    await navigator.clipboard.writeText(generated.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setGenerated(null);
    onOpenChange(false);
  };

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={closeModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription className="text-destructive font-medium">
              This key will never be shown again. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
                One-time key
              </p>
              <code className="block break-all text-sm font-mono text-foreground">{generated.key}</code>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={copyKey}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied" : "Copy Key"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={closeModal}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate New API Key</DialogTitle>
          <DialogDescription>
            Create a key for digital marketing partners to submit leads and confirm payments.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              placeholder="DigitalMarketing-Agency-1"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label>Permissions</Label>
            <div className="mt-2 space-y-2">
              {API_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={selectedPermissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                  />
                  <span className="font-mono text-xs">{perm}</span>
                </label>
              ))}
            </div>
            {errors.permissions && (
              <p className="text-sm text-destructive mt-1">{errors.permissions.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="expires-at">Expiry Date (optional)</Label>
            <Input id="expires-at" type="datetime-local" {...register("expiresAt")} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Generating…" : "Generate Key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

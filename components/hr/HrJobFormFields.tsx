"use client";

import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { HrJobInput } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type HrJobFormFieldsProps = {
  register: UseFormRegister<HrJobInput>;
  errors: FieldErrors<HrJobInput>;
  setValue: UseFormSetValue<HrJobInput>;
  watch: UseFormWatch<HrJobInput>;
};

export function HrJobFormFields({ register, errors, setValue, watch }: HrJobFormFieldsProps) {
  const employmentType = watch("employmentType");

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <Label>Job Title</Label>
        <Input {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Organization Name</Label>
        <Input {...register("organisationName")} />
        {errors.organisationName && (
          <p className="text-sm text-destructive">{errors.organisationName.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Job Location</Label>
        <Input {...register("location")} />
      </div>
      <div className="space-y-1">
        <Label>Employment Type</Label>
        <Select
          value={employmentType}
          onValueChange={(v) =>
            setValue("employmentType", v as HrJobInput["employmentType"], { shouldValidate: true })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="internship">Internship</SelectItem>
            <SelectItem value="full_time">Full time</SelectItem>
            <SelectItem value="part_time">Part time</SelectItem>
          </SelectContent>
        </Select>
        {errors.employmentType && (
          <p className="text-sm text-destructive">{errors.employmentType.message}</p>
        )}
      </div>
      {employmentType === "internship" && (
        <div className="space-y-1">
          <Label>Stipend</Label>
          <Input {...register("stipend")} />
        </div>
      )}
      {employmentType === "part_time" && (
        <div className="space-y-1">
          <Label>Salary per Month</Label>
          <Input {...register("salary")} />
        </div>
      )}
      {(!employmentType || employmentType === "full_time") && (
        <div className="space-y-1">
          <Label>CTC</Label>
          <Input {...register("ctc")} />
        </div>
      )}
      <div className="space-y-1">
        <Label>Experience Required</Label>
        <Input {...register("experienceRequired")} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label>Description</Label>
        <Textarea {...register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label>Roles and Responsibilities</Label>
        <Textarea {...register("responsibilities")} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label>Required Skills</Label>
        <Textarea {...register("requiredSkills")} />
      </div>
      <div className="space-y-1 md:col-span-2">
        <Label>Eligibility Criteria</Label>
        <Textarea {...register("eligibilityCriteria")} />
      </div>
      <div className="space-y-1">
        <Label>Last Date to Apply</Label>
        <Input type="datetime-local" {...register("applicationDeadline")} />
        {errors.applicationDeadline && (
          <p className="text-sm text-destructive">{errors.applicationDeadline.message}</p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Openings</Label>
        <Input type="number" min={1} {...register("openings")} />
      </div>
    </div>
  );
}

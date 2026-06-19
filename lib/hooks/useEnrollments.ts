"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignCoursesAction,
  bulkAssignAction,
  getStudentEnrollmentsAction,
  listEnrollmentsAction,
  updateEnrollmentAction,
  updateModuleProgressAction,
} from "@/lib/actions/enrollment";
import type { AssignCoursesInput, UpdateEnrollmentInput, BulkAssignInput } from "@/lib/validations/enrollment";

export function useStudentEnrollments(studentId: string) {
  return useQuery({
    queryKey: ["student-enrollments", studentId],
    queryFn: async () => {
      const res = await getStudentEnrollmentsAction(studentId);
      if (!res.success) throw new Error(typeof res.error === "string" ? res.error : "Failed to load");
      return res.data;
    },
    enabled: !!studentId,
  });
}

export function useEnrollmentsList(filters: {
  studentId?: string;
  orgId?: string;
  courseId?: string;
  status?: string;
  accessType?: string;
}) {
  return useQuery({
    queryKey: ["enrollments-list", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
      const res = await fetch(`/api/enrollments?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load enrollments");
      return json.data as Record<string, unknown>[];
    },
  });
}

export function useAssignCoursesMutation(studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AssignCoursesInput, "studentId">) =>
      assignCoursesAction({ ...input, studentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-enrollments", studentId] });
      qc.invalidateQueries({ queryKey: ["enrollments-list"] });
    },
  });
}

export function useUpdateEnrollmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEnrollmentInput }) =>
      updateEnrollmentAction(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
      qc.invalidateQueries({ queryKey: ["enrollments-list"] });
    },
  });
}

export function useBulkAssignMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkAssignInput) => bulkAssignAction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollments-list"] });
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
    },
  });
}

export function useMarkModuleProgressMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateModuleProgressAction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
  });
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const res = await fetch("/api/student/courses");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      return (json.data ?? json) as Record<string, unknown>[];
    },
  });
}

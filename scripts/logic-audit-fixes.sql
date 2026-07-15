-- Enforce at most one active (non-revoked) certificate per student per course.
-- Run on Neon before relying on concurrent auto-issue paths.

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_cert_per_student_course
ON issued_certificates (student_id, course_id, course_type)
WHERE is_revoked = false;

-- Align slotConsumed default for new rows
ALTER TABLE student_courses
  ALTER COLUMN slot_consumed SET DEFAULT false;

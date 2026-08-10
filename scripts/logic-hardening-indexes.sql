-- Logic-hardening indexes (run on Neon/Postgres after deploy).
-- Safe to re-run: uses IF NOT EXISTS.

-- One partner lead per email + record course (blocks concurrent duplicate POSTs)
CREATE UNIQUE INDEX IF NOT EXISTS partner_leads_email_record_course_uq
  ON partner_leads (email, record_course_id);

-- One active (non-revoked) certificate per student per course
CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_student_course_active
  ON issued_certificates (student_id, course_id, course_type)
  WHERE is_revoked = false;

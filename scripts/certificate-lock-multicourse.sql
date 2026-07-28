-- Certificate multi-course links + locked-until-duration unlock
-- Run against Neon/Postgres before or with deploy.

CREATE TABLE IF NOT EXISTS certificate_template_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES certificate_templates(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  course_type course_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cert_tmpl_course
  ON certificate_template_courses (template_id, course_id, course_type);
CREATE INDEX IF NOT EXISTS idx_cert_tmpl_courses_tmpl
  ON certificate_template_courses (template_id);
CREATE INDEX IF NOT EXISTS idx_cert_tmpl_courses_course
  ON certificate_template_courses (course_id, course_type);

-- Backfill from existing single courseId on templates
INSERT INTO certificate_template_courses (template_id, course_id, course_type)
SELECT id, course_id, course_type
FROM certificate_templates
WHERE course_id IS NOT NULL AND course_type IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE issued_certificates
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlock_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cert_locked_unlock
  ON issued_certificates (is_locked, unlock_at);

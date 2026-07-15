-- Link certificate auto-issue templates to batches (live courses).
-- Run once on Neon / Postgres before deploying the app that uses batchId.

ALTER TABLE certificate_templates
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES batches(id);

CREATE INDEX IF NOT EXISTS idx_cert_tmpl_batch ON certificate_templates(batch_id);

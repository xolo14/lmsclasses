-- Add course_id column to users table for mentor course assignment
ALTER TABLE users ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES live_courses(id);
CREATE INDEX IF NOT EXISTS users_course_id_idx ON users(course_id);

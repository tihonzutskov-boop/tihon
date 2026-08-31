-- GYDE database schema. Idempotent: safe to run on every server startup.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  joined_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  google_id VARCHAR(255),
  avatar_url VARCHAR(500)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

CREATE TABLE IF NOT EXISTS gyms (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  dimensions JSONB,
  entrance JSONB,
  floor_color VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zones (
  id VARCHAR(100) PRIMARY KEY,
  gym_id VARCHAR(100) NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  width DOUBLE PRECISION,
  height DOUBLE PRECISION,
  color VARCHAR(50),
  icon VARCHAR(100),
  description TEXT,
  machines JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS annexes (
  id VARCHAR(100) PRIMARY KEY,
  gym_id VARCHAR(100) NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  x DOUBLE PRECISION,
  y DOUBLE PRECISION,
  width DOUBLE PRECISION,
  height DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS equipment (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(150),
  description TEXT,
  icon VARCHAR(100),
  image_url TEXT,
  default_footprint JSONB,
  is_floor_space BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS exercises (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  target_muscle VARCHAR(255) NOT NULL,
  equipment_required VARCHAR(255),
  category VARCHAR(150),
  instructions TEXT,
  equipment_id VARCHAR(100),
  video_url VARCHAR(255),
  image_url TEXT
);

-- The create/edit form has always collected these three, but the POST/PUT
-- routes never read or stored them — required_equipment_ids is what the
-- Equipment Library picker's checkboxes actually save to (equipment_id
-- above is a single zone/location, unrelated), and make_harder/make_easier
-- are REQUIRED fields on that same form. All three were silently discarded
-- on every save until now.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS required_equipment_ids JSONB DEFAULT '[]';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS make_harder TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS make_easier TEXT;

-- Uploaded photos are stored as base64 data URIs (no file-hosting backend),
-- which are far longer than VARCHAR(255) — widen for tables already deployed
-- before this change.
ALTER TABLE equipment ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE exercises ALTER COLUMN image_url TYPE TEXT;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS muscle_groups JSONB DEFAULT '[]';

-- Tutorial video is a separate uploaded <video> (base64 data URI), distinct
-- from the pasted-YouTube-link video_url column above, so it supports real
-- timestamp seeking; steps is the step-by-step breakdown with optional
-- per-step timestamps into that video.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS tutorial_video_file_name VARCHAR(255);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]';

-- 'video' exercises are a YouTube follow-along (warmup, mobility, cooldown)
-- with no equipment/sets — they reuse the video_url column above for the
-- YouTube link and just add a free-text duration label for display.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(20);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_duration_label VARCHAR(50);

-- A Harder/Easier variation gets a tutorial one of two ways: link to another
-- exercise's own full entry (harder/easier_exercise_id), or a lightweight
-- inline tutorial of just a YouTube link + plain steps (harder/easier_tutorial).
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS harder_exercise_id VARCHAR(255);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS easier_exercise_id VARCHAR(255);
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS harder_tutorial JSONB DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS easier_tutorial JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS workout_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_name VARCHAR(255),
  exercise_count INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 45,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  plan_day_id VARCHAR(100)
);

ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS plan_day_id VARCHAR(100);

-- One persisted training plan per user (id, name, and a weekday-scheduled
-- WorkoutDay[] blob mirroring the shape already used for zones.machines).
CREATE TABLE IF NOT EXISTS user_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'My Training Plan',
  days JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One persisted intake questionnaire per user, captured before a coach
-- builds their plan. Free-form JSONB since the field set is still evolving.
CREATE TABLE IF NOT EXISTS training_questionnaires (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reusable plan templates, categorized by goal + days/week. On questionnaire
-- submission the server matches one of these and copies it into user_plans
-- with weekdays assigned — no per-user hand-building.
CREATE TABLE IF NOT EXISTS plan_templates (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  goal VARCHAR(100) NOT NULL,
  days_per_week VARCHAR(10) NOT NULL,
  days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Target single-session length in minutes, set by the admin per template and
-- enforced as a hard cap in the session builder (existing rows default to 45).
ALTER TABLE plan_templates ADD COLUMN IF NOT EXISTS duration_min INTEGER NOT NULL DEFAULT 45;

-- Which catalog template (if any) a user's plan was assigned from, so
-- editing that template can push the update to everyone still using it.
-- NULL for plans predating this column, or never matched to a template.
ALTER TABLE user_plans ADD COLUMN IF NOT EXISTS source_template_id VARCHAR(100) REFERENCES plan_templates(id) ON DELETE SET NULL;

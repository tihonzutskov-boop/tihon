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
  image_url VARCHAR(255),
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
  image_url VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_name VARCHAR(255),
  exercise_count INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 45,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

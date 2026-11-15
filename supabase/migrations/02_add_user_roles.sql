-- Add role columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_source TEXT DEFAULT 'normal_register',
  ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'email';


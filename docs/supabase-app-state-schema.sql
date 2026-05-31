-- Minimal production persistence table for the existing Express API.
-- Run this in Supabase SQL Editor, or let the backend auto-create it on first start.

create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- The Express server uses the Supabase Postgres connection string securely on the backend.
-- Do not expose DATABASE_URL in the React frontend.

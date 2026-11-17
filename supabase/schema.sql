create extension if not exists pgcrypto;

create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  questions jsonb not null,
  edit_key_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quiz_sets enable row level security;

-- No public RLS policies are created. The Express server accesses this table
-- with the Supabase service-role key stored only in Render environment variables.

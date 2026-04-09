-- Outbindr sessions table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hghvdfvijqevsofqsiro/sql

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  status         text default 'in_progress' not null
                   check (status in ('in_progress','completed')),
  title          text,
  config         jsonb default '{}'::jsonb not null,
  history        jsonb default '[]'::jsonb not null,
  verdict        jsonb,
  idea_text      text default '',
  current_round  int default 0,
  setup_state    jsonb default null,
  is_public      boolean default false not null
);

-- Row Level Security
alter table public.sessions enable row level security;

create policy "users_select_own" on public.sessions
  for select using (auth.uid() = user_id);

create policy "users_insert_own" on public.sessions
  for insert with check (auth.uid() = user_id);

create policy "users_update_own" on public.sessions
  for update using (auth.uid() = user_id);

create policy "users_delete_own" on public.sessions
  for delete using (auth.uid() = user_id);

-- Migration: run these if you have an existing sessions table
-- alter table public.sessions add column if not exists setup_state jsonb default null;
-- alter table public.sessions alter column config set default '{}'::jsonb;
-- alter table public.sessions add column if not exists is_public boolean default false not null;

-- Public replay policy — allows anonymous access to sessions marked public
create policy "public_replay_select" on public.sessions
  for select using (is_public = true);

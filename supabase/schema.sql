-- PitchWars sessions table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hghvdfvijqevsofqsiro/sql

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null,
  status         text default 'in_progress' not null
                   check (status in ('in_progress','completed')),
  title          text,
  config         jsonb not null,
  history        jsonb default '[]'::jsonb not null,
  verdict        jsonb,
  idea_text      text default '',
  current_round  int default 0
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

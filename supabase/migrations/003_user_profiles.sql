-- Hertz LMS - User profiles for auth (role assignment)
-- Run after 001_initial_schema.sql
-- Supabase Auth (auth.users) must exist

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('bm', 'gm', 'admin')),
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

-- Authenticated users can read their own profile
create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

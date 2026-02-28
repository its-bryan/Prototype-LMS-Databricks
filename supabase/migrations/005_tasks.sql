-- Hertz LMS - Tasks table for GM-assigned and auto-created tasks
-- Run after 001_initial_schema.sql

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  due_date date,
  status text not null default 'Open' check (status in ('Open', 'In Progress', 'Done')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  lead_id bigint,
  source text default 'gm_assigned' check (source in ('gm_assigned', 'auto_translog', 'auto_other')),
  translog_event_id bigint,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tasks_assigned_to on tasks(assigned_to);
create index idx_tasks_status on tasks(status);
create index idx_tasks_lead_id on tasks(lead_id);

alter table public.tasks enable row level security;

-- Authenticated users can read tasks assigned to them
create policy "Users can read own tasks"
  on public.tasks for select
  using (auth.uid() = assigned_to);

-- GMs can insert/update (for assignment); BMs can update (status)
create policy "Authenticated can manage tasks"
  on public.tasks for all
  using (auth.role() = 'authenticated');

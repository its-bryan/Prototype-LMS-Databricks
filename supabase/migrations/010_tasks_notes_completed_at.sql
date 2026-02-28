-- Hertz LMS - Tasks: notes, completed_at, display names for created_by/assigned_to
-- Run after 009_tasks_lead_fk_and_priority.sql

-- BM work notes (e.g. "Called 3x, left voicemail")
alter table public.tasks
  add column if not exists notes text;

-- When status changed to Done
alter table public.tasks
  add column if not exists completed_at timestamptz;

-- Denormalized display names for UI (resolved from user_profiles)
alter table public.tasks
  add column if not exists created_by_name text;

alter table public.tasks
  add column if not exists assigned_to_name text;

-- Backfill names from user_profiles where possible
update public.tasks t
set created_by_name = up.display_name
from public.user_profiles up
where t.created_by = up.id and t.created_by_name is null;

update public.tasks t
set assigned_to_name = up.display_name
from public.user_profiles up
where t.assigned_to = up.id and t.assigned_to_name is null;

comment on column public.tasks.notes is 'BM work notes (e.g. call attempts, follow-up details)';
comment on column public.tasks.completed_at is 'Set when status changes to Done';
comment on column public.tasks.created_by_name is 'Display name of task creator (GM)';
comment on column public.tasks.assigned_to_name is 'Display name of assignee (BM)';

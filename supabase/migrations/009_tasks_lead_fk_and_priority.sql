-- Hertz LMS - Tasks: FK to leads, lead_id required, add priority
-- Run after 008_lead_activities.sql

-- Remove any tasks with null lead_id before enforcing constraint
delete from public.tasks where lead_id is null;

-- Add FK to leads; make lead_id required
alter table public.tasks
  add constraint fk_tasks_lead
  foreign key (lead_id) references public.leads(id) on delete cascade;

alter table public.tasks
  alter column lead_id set not null;

-- Add priority field
alter table public.tasks
  add column if not exists priority text not null default 'Normal'
  check (priority in ('Urgent', 'High', 'Normal', 'Low'));

create index if not exists idx_tasks_priority on public.tasks(priority);

comment on column public.tasks.priority is 'Task priority for triage and display order';

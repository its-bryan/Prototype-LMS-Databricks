-- Hertz LMS - Lead contact activities (Email, SMS, Call)
-- Persists contact actions on a lead's profile for audit and timeline display.
-- Run after 006_lead_contact_fields.sql

create table if not exists public.lead_activities (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.leads(id) on delete cascade,
  type text not null check (type in ('email', 'sms', 'call')),
  performed_by uuid references auth.users(id) on delete set null,
  performed_by_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_lead_activities_lead_id on public.lead_activities(lead_id);
create index idx_lead_activities_created_at on public.lead_activities(created_at);

alter table public.lead_activities enable row level security;

-- Authenticated users can read activities for leads (same as leads read policy)
create policy "Allow read lead_activities"
  on public.lead_activities for select
  using (true);

-- Service role / edge functions insert via service key (bypasses RLS)
-- For client inserts: allow authenticated users to insert
create policy "Authenticated can insert lead_activities"
  on public.lead_activities for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

comment on table public.lead_activities is 'Contact activities (email, SMS, call) on leads';
comment on column public.lead_activities.metadata is 'External IDs + content: for email: id, subject, body, to; for SMS: sid; for call: callSid';

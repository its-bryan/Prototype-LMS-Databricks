-- Hertz LMS - Allow users to update their own profile (e.g. phone)
-- Run after 006_lead_contact_fields.sql

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

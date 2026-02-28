-- Hertz LMS - Task notes as append-only log (like enrichment_log / TRANSLOG activity)
-- Run after 011_seed_mock_data_full.sql
-- Each note is stored with timestamp and author; notes are appended, not overwritten.

-- Append-only log: [{ time, timestamp, author, note }, ...]
alter table public.tasks
  add column if not exists notes_log jsonb default '[]'::jsonb;

-- Migrate existing notes into notes_log (single entry with "—" author if unknown)
update public.tasks
set notes_log = jsonb_build_array(
  jsonb_build_object(
    'time', to_char(updated_at, 'Mon DD, HH12:MI AM'),
    'timestamp', extract(epoch from updated_at) * 1000,
    'author', '—',
    'note', notes
  )
)
where notes is not null and trim(notes) != '' and (notes_log is null or notes_log = '[]'::jsonb);

-- Keep notes column for backward compatibility (can store latest note summary if desired)
-- New notes go into notes_log; notes column is deprecated for new entries.
comment on column public.tasks.notes_log is 'Append-only log of task notes with timestamp and author (like enrichment_log)';

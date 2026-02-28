-- Hertz LMS - Seed data from mockData.js
-- Run after 001_initial_schema.sql

-- Org mapping
insert into org_mapping (bm, branch, am, gm, zone) values
  ('J. Smith', 'Downtown LA', 'K. Chen', 'D. Williams', 'Eastern'),
  ('M. Johnson', 'Santa Monica', 'K. Chen', 'D. Williams', 'Eastern'),
  ('A. Garcia', 'Pasadena', 'K. Chen', 'D. Williams', 'Eastern'),
  ('S. Lee', 'Long Beach', 'K. Chen', 'D. Williams', 'Eastern'),
  ('T. Brown', 'Anaheim', 'K. Chen', 'D. Williams', 'Eastern'),
  ('R. Davis', 'San Diego Central', 'L. Park', 'R. Martinez', 'Southern'),
  ('E. Wilson', 'La Jolla', 'L. Park', 'R. Martinez', 'Southern'),
  ('P. Taylor', 'Carlsbad', 'L. Park', 'R. Martinez', 'Southern'),
  ('C. Anderson', 'Mission Valley', 'L. Park', 'R. Martinez', 'Southern'),
  ('N. Thomas', 'Chula Vista', 'L. Park', 'R. Martinez', 'Southern'),
  ('B. Jackson', 'Sacramento North', 'M. Nguyen', null, 'Northern'),
  ('D. White', 'Roseville', 'M. Nguyen', 'R. Martinez', 'Northern'),
  ('F. Harris', 'Folsom', 'M. Nguyen', 'R. Martinez', 'Northern'),
  ('G. Clark', 'Elk Grove', 'M. Nguyen', null, 'Northern'),
  ('H. Lewis', 'Davis', 'M. Nguyen', 'R. Martinez', 'Northern');

-- Branch managers
insert into branch_managers (name, conversion_rate, quartile) values
  ('J. Smith', 72, 1), ('M. Johnson', 68, 2), ('A. Garcia', 61, 3),
  ('S. Lee', 58, 4), ('T. Brown', 75, 1), ('R. Davis', 65, 2),
  ('E. Wilson', 70, 1), ('P. Taylor', 63, 3), ('C. Anderson', 59, 4),
  ('N. Thomas', 67, 2);

-- Leads
insert into leads (
  customer, reservation_id, status, archived, enrichment_complete, branch, bm_name,
  days_open, mismatch, gm_directive, insurance_company, time_to_first_contact,
  first_contact_by, time_to_cancel, hles_reason, last_activity, translog, enrichment
) values
  ('John Martinez', 'HL-2026-001234', 'Cancelled', false, true, 'Downtown LA', 'J. Smith',
   4, false, null, 'Progressive', '2h 15m', 'branch', '3d 2h', 'Customer no-show',
   '2026-02-12T10:00:00',
   '[{"time":"Feb 10, 9:15 AM","event":"Call","outcome":"No answer"},{"time":"Feb 11, 2:30 PM","event":"Call","outcome":"Left voicemail"},{"time":"Feb 12, 10:00 AM","event":"SMS","outcome":"Sent reminder"}]'::jsonb,
   '{"reason":"Unable to reach — no answer after multiple attempts","notes":"Called 3x over 2 days","nextAction":"Call again","followUpDate":"Feb 22, 2026"}'::jsonb),
  ('Sarah Chen', 'HL-2026-001235', 'Cancelled', false, true, 'Santa Monica', 'M. Johnson',
   2, false, null, 'Geico', '45m', 'branch', '1d 8h', null,
   '2026-02-15T15:00:00',
   '[{"time":"Feb 14, 11:00 AM","event":"Call","outcome":"Spoke — rescheduled"},{"time":"Feb 15, 3:00 PM","event":"Call","outcome":"No show — customer confirmed pickup"}]'::jsonb,
   '{"reason":"No-show after confirmation","notes":"Customer confirmed pickup last Tuesday but never showed","nextAction":"Call again","followUpDate":"Feb 22, 2026"}'::jsonb),
  ('Michael Torres', 'HL-2026-001236', 'Cancelled', false, false, 'Pasadena', 'A. Garcia',
   6, true, null, 'State Farm', '5d 2h', 'hrd', '6d 4h', 'Unable to reach',
   '2026-02-13T14:00:00',
   '[{"time":"Feb 8, 9:00 AM","event":"Call","outcome":"No answer"},{"time":"Feb 13, 2:00 PM","event":"Call","outcome":"Voicemail"}]'::jsonb,
   null),
  ('Emily Davis', 'HL-2026-001237', 'Unused', false, false, 'Long Beach', 'S. Lee',
   8, false, null, 'Allstate', null, 'none', null, null,
   null, '[]'::jsonb, null),
  ('Robert Kim', 'HL-2026-001238', 'Rented', false, true, 'Anaheim', 'T. Brown',
   1, false, null, 'Farmers', '30m', 'branch', null, null,
   '2026-02-20T10:00:00',
   '[{"time":"Feb 20, 10:00 AM","event":"Call","outcome":"Converted"}]'::jsonb,
   '{}'::jsonb);

-- Weekly trends (BM)
insert into weekly_trends (type, week_label, week_start, total_leads, conversion_rate, comment_rate) values
  ('bm', 'Feb 3–9', '2026-02-03', 142, 64, 88),
  ('bm', 'Feb 10–16', '2026-02-10', 156, 67, 91),
  ('bm', 'Feb 17–23', '2026-02-17', 148, 69, 92);

-- Weekly trends (GM)
insert into weekly_trends (type, week_label, week_start, cancelled_unreviewed, comment_compliance, zone_conversion_rate, time_to_contact, branch_contact_rate, hrd_contact_rate) values
  ('gm', 'Feb 3–9', '2026-02-03', 28, 85, 64, '{"under24h":72,"under48h":88,"over48h":12}'::jsonb, 78, 22),
  ('gm', 'Feb 10–16', '2026-02-10', 23, 91, 67, '{"under24h":75,"under48h":90,"over48h":10}'::jsonb, 80, 20),
  ('gm', 'Feb 17–23', '2026-02-17', 19, 93, 69, '{"under24h":78,"under48h":92,"over48h":8}'::jsonb, 82, 18);

-- Upload summary
insert into upload_summary (hles, translog, data_as_of_date) values
  ('{"rowsParsed":1247,"newLeads":89,"updated":156,"unchanged":1002,"failed":3,"failedDetails":["Row 234: Invalid date format","Row 567: Missing branch code","Row 891: Duplicate reservation ID"]}'::jsonb,
  '{"eventsParsed":4521,"matched":3892,"orphan":629}'::jsonb,
  '2026-02-26');

-- Leaderboard
insert into leaderboard_data (branches, gms, ams, zones) values
  ('[{"name":"Anaheim","conversionRate":75,"leads":48,"priorConversionRate":72},{"name":"Downtown LA","conversionRate":72,"leads":62,"priorConversionRate":68},{"name":"La Jolla","conversionRate":70,"leads":41,"priorConversionRate":67},{"name":"Santa Monica","conversionRate":68,"leads":55,"priorConversionRate":65},{"name":"San Diego Central","conversionRate":65,"leads":58,"priorConversionRate":63},{"name":"Long Beach","conversionRate":58,"leads":44,"priorConversionRate":61}]'::jsonb,
  '[{"name":"D. Williams","conversionRate":68,"branches":5},{"name":"R. Martinez","conversionRate":65,"branches":6}]'::jsonb,
  '[{"name":"K. Chen","conversionRate":67,"branches":5},{"name":"L. Park","conversionRate":64,"branches":5},{"name":"M. Nguyen","conversionRate":62,"branches":5}]'::jsonb,
  '[{"name":"Eastern","conversionRate":68,"branches":5},{"name":"Southern","conversionRate":65,"branches":5},{"name":"Northern","conversionRate":63,"branches":5}]'::jsonb);

-- Cancellation reason categories
insert into cancellation_reason_categories (category, reasons, sort_order) values
  ('Customer Unreachable', '["Unable to reach — no answer after multiple attempts","Invalid or disconnected phone number","Customer requested callback — never answered"]'::jsonb, 1),
  ('Customer Decision', '["Found better rate elsewhere","Changed travel plans","Decided not to rent","Rented from competitor"]'::jsonb, 2),
  ('Operational', '["No-show after confirmation","Documentation issues — could not complete","Vehicle availability — customer declined alternative"]'::jsonb, 3),
  ('Other', '["Duplicate reservation","Test or training lead","Other (see notes)"]'::jsonb, 4);

-- Next actions
insert into next_actions (action, sort_order) values
  ('Call again', 1), ('Send follow-up SMS', 2), ('Escalate to AM', 3),
  ('Close — no further action', 4), ('Verify documentation', 5), ('Other (see notes)', 6);

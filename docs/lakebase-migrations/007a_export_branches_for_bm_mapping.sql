-- Run in Lakebase SQL Editor (lms-leo / production). Export result as CSV for scripts/generate_bm_org_sql.py
-- Adjust GM filter to match your HLES spelling (Frankel vs regional GMs).
-- Employee listing: GM is Adam Frankel (HR "Frankel, Adam Howard"); he often shows as Supervisor to AMs.
-- GM on leads should align with that cluster when HLES general_mgr is populated.

SELECT DISTINCT
  branch,
  area_mgr,
  general_mgr,
  zone
FROM leads
WHERE general_mgr ILIKE '%Frankel%'
   OR general_mgr ILIKE '%Adam%Frankel%'
ORDER BY branch;

-- Alternative: use org_mapping after HLES sync (same GM filter):
-- SELECT branch, am, gm, zone FROM org_mapping
-- WHERE gm ILIKE '%Frankel%' OR gm ILIKE '%Adam%Frankel%'
-- ORDER BY branch;

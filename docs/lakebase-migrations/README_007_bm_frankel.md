# Branch manager (`org_mapping.bm`) — Frankel cluster

## Frankel in the employee file

**Adam Frankel** (HR format **Frankel, Adam Howard** = *Last, First Middle*: Howard is middle name, not a second supervisor) usually appears in **`Supervisor Name`**, not HRBP—for example, area managers report to him. In the March 2026 listing, **row ~23** shows **1303 / HLE East Florida Miami Suburban** with **Joshua B Seid** as area manager and **Frankel, Adam Howard** as his supervisor.

Default mode **`supervisor_frankel`** walks each Mgr Branch I/II row up **Supervisor Name** until the string matches **Adam Frankel** (implementation: both **Frankel** and **Adam** appear in the supervisor name, which is true for `Frankel, Adam Howard`). Use **`hrbp_frankel`** only if your extract has Frankel in the HRBP column.

---

1. **Export branches** — Run `007a_export_branches_for_bm_mapping.sql` in Lakebase; save the result as CSV (e.g. `frankel_branches.csv` locally). Columns: `branch`, `area_mgr`, `general_mgr`, `zone`.

2. **Generate UPDATE SQL** — From repo root:

   ```powershell
   python scripts/generate_bm_org_sql.py `
     --excel "C:/path/to/March 2026 employee listing.xlsx" `
     --branches-csv "C:/path/to/frankel_branches.csv" `
     --out docs/lakebase-migrations/007_bm_from_employee_listing_frankel.sql
   ```

   - **`--cluster supervisor_frankel`** (default): Mgr Branch I/II in Adam Frankel’s supervisor chain (use when HRBP ≠ Frankel).
   - **`--cluster hrbp_frankel`**: HRBP contains Frankel.
   - **`--cluster zone_frankel_team`**: Same Zone as direct reports of Frankel.

3. **Review** the generated comments (unmatched BMs, duplicate-branch warnings), then run the `UPDATE org_mapping … FROM (VALUES …)` block in Lakebase.

4. **Re-run monthly** with a new employee file and a fresh branch export.

See `scripts/generate_bm_org_sql.py` docstring for match rules (Area = leading branch segment before `-`).

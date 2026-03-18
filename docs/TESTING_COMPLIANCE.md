# Compliance / GM Meeting Prep — testing

## Automated (run before deploy)

```powershell
npm test          # Vitest — compliance selector logic (12 tests)
npm run build     # Production bundle
```

Backend smoke:

```powershell
python -m py_compile main.py db.py
Get-ChildItem routers\*.py | ForEach-Object { python -m py_compile $_.FullName }
```

## What the tests cover

`src/selectors/complianceSelectors.test.js` exercises:

- Cancelled leads without BM comment
- Unused leads without BM activity in the selected date window
- **Old** cancelled leads (init outside the week) still count toward compliance
- Per-branch isolation (branch A vs B)
- `getLeadsWithOutstandingItemsForBranch` for task creation

## Manual E2E (browser, after deploy)

1. Sign in as a **GM** whose branches exist in `org_mapping` / leads (`general_mgr`).
2. Open **GM Work** → **Meeting prep** (compliance meeting).
3. Set date preset to **This week**.
4. Expand **Branch compliance**:
   - Branches with **cancelled + no BM notes** should show **Pending** and a non-zero outstanding count (even if the lead is from an older week).
   - Branches with **unused** leads and **no enrichment activity this week** should count as outstanding.
5. Click a branch row → detail pane tabs: **Cancelled — no BM comment**, **Unused — no BM activity in period**, **Data mismatches**.

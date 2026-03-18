# Front-End Test Plan — LEO Production

> **Target:** Every page must become interactive in **< 2 seconds**.
> **Production URL:** `https://hertz-leo-leadsmgmtsystem-1957546315544672.aws.databricksapps.com/`

---

## 1. Test Credentials

| Role   | Email                            | Password       | Default View      |
|--------|----------------------------------|----------------|-------------------|
| Admin  | `admin.leo@hertz.com`            | `LeoAdmin123`  | admin-dashboard   |
| GM     | `adamfrankel.leo@hertz.com`      | `AdamF123`     | gm-overview       |
| BM     | `jonathanhoover.leo@hertz.com`   | `JonathanH123` | bm-dashboard      |

---

## 2. Pages to Test (per role)

### 2.1 Admin Pages

| #  | Sidebar Label           | View ID            | Key API Calls                                     |
|----|-------------------------|--------------------|----------------------------------------------------|
| A1 | Dashboard               | admin-dashboard    | `fetchDashboardSnapshot`, `fetchLeads`             |
| A2 | Data Uploads            | admin-uploads      | `fetchUploadSummary`, `fetchUploadHistory`         |
| A3 | Org Mapping             | admin-org-mapping  | `fetchOrgMapping`, `fetchBranchManagers`           |
| A4 | Cancellation Reasons    | admin-legend       | `fetchCancellationReasonCategories`                |

### 2.2 GM Pages

| #  | Sidebar Label           | View ID              | Key API Calls                                     |
|----|-------------------------|----------------------|----------------------------------------------------|
| G1 | Summary                 | gm-overview          | `fetchDashboardSnapshot`, `fetchLeads`             |
| G2 | Work                    | gm-todos             | `fetchTasksForGM`                                  |
| G3 | Meeting Prep            | gm-meeting-prep      | `fetchLeads`, `fetchTasksForGM`                    |
| G4 | Spot Check              | gm-spot-check        | `fetchLeads`                                       |
| G5 | Business Metrics        | gm-business-metrics  | `fetchWeeklyTrends`, `fetchDashboardSnapshot`      |
| G6 | Team Performance        | gm-team-performance  | `fetchLeads`, `fetchLeaderboardData`               |
| G7 | Activity Report         | gm-activity-report   | `fetchLeads`                                       |

### 2.3 BM Pages

| #  | Sidebar Label           | View ID            | Key API Calls                                     |
|----|-------------------------|--------------------|----------------------------------------------------|
| B1 | Summary                 | bm-dashboard       | `fetchDashboardSnapshot`, `fetchLeads`             |
| B2 | Work                    | bm-work            | `fetchLeads`, `fetchTasksForBranch`                |
| B3 | Meeting Prep            | bm-meeting-prep    | `fetchLeads`, `fetchTasksForBranch`                |
| B4 | Leaderboard             | bm-leaderboard     | `fetchLeaderboardData`                             |
| B5 | My Leads                | bm-leads           | `fetchLeads`                                       |
| B6 | Open Tasks              | bm-todo            | `fetchTasksForBranch`                              |

---

## 3. Test Procedure (per role)

```
1. Navigate to production URL
2. Screenshot the login screen
3. Enter email + password → click Sign In
4. Record time-to-interactive for the default landing page
5. For each page in the role's nav:
   a. Click the sidebar item
   b. Wait for content to render (spinners gone, data visible)
   c. Record load time category: FAST (< 1s) | OK (1–2s) | SLOW (> 2s)
   d. Screenshot the loaded page
   e. Check browser console for errors (red messages)
6. Sign out
```

### Console log collection

Open DevTools → Console tab before starting. After each page navigation, capture:
- Any `Error` or `Warning` entries
- Any failed network requests (4xx / 5xx)
- React rendering errors or unhandled promise rejections

---

## 4. What to Flag

| Severity | Condition                                         |
|----------|---------------------------------------------------|
| BLOCKER  | Page does not load at all / white screen           |
| CRITICAL | Page takes > 2 seconds to become interactive       |
| WARNING  | Console errors present but page still functional   |
| INFO     | Minor layout issues, missing data, cosmetic bugs   |

---

## 5. Results Template

### Login

| Role  | Login Success | Time to Dashboard |
|-------|---------------|-------------------|
| Admin |               |                   |
| GM    |               |                   |
| BM    |               |                   |

### Page Load Times

| Page ID | Page Name            | Role  | Load Time | Category | Console Errors | Visual Issues |
|---------|----------------------|-------|-----------|----------|----------------|---------------|
| A1      | Dashboard            | Admin |           |          |                |               |
| A2      | Data Uploads         | Admin |           |          |                |               |
| A3      | Org Mapping          | Admin |           |          |                |               |
| A4      | Cancellation Reasons | Admin |           |          |                |               |
| G1      | Summary              | GM    |           |          |                |               |
| G2      | Work                 | GM    |           |          |                |               |
| G3      | Meeting Prep         | GM    |           |          |                |               |
| G4      | Spot Check           | GM    |           |          |                |               |
| G5      | Business Metrics     | GM    |           |          |                |               |
| G6      | Team Performance     | GM    |           |          |                |               |
| G7      | Activity Report      | GM    |           |          |                |               |
| B1      | Summary              | BM    |           |          |                |               |
| B2      | Work                 | BM    |           |          |                |               |
| B3      | Meeting Prep         | BM    |           |          |                |               |
| B4      | Leaderboard          | BM    |           |          |                |               |
| B5      | My Leads             | BM    |           |          |                |               |
| B6      | Open Tasks           | BM    |           |          |                |               |

### Summary

- **Total pages tested:**
- **Pages under 2s:**
- **Pages over 2s (CRITICAL):**
- **Console errors found:**
- **Visual bugs found:**

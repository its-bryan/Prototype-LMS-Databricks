# Frontend Route Map

This document describes the URL-based routing introduced in the React Router migration.

## Route Table

| Path | Component | Role |
|---|---|---|
| `/login` | `LoginScreen` | Public |
| `/bm/summary` | `BMSummaryPage` | BM |
| `/bm/work` | `BMWorkPage` | BM |
| `/bm/leads` | `BMLeadsPage` | BM |
| `/bm/leads/:leadId` | `InteractiveLeadDetail` | BM |
| `/bm/tasks` | `BMTasksPage` | BM |
| `/bm/tasks/:taskId` | `InteractiveTaskDetail` | BM |
| `/bm/meeting-prep` | `InteractiveMeetingPrepPage` | BM |
| `/bm/leaderboard` | `InteractiveLeaderboardPage` | BM |
| `/gm/overview` | `GMOverviewPage` | GM |
| `/gm/work` | `GMWorkPage` | GM |
| `/gm/meeting-prep` | `InteractiveGMMeetingPrepPage` | GM |
| `/gm/spot-check` | `InteractiveGMSpotCheckPage` | GM |
| `/gm/activity-report` | `InteractiveGMActivityReportPage` | GM |
| `/gm/leaderboard` | `InteractiveGMLeaderboardPage` | GM |
| `/gm/leads/:leadId` | `InteractiveLeadDetail` | GM |
| `/gm/tasks/:taskId` | `InteractiveTaskDetail` | GM |
| `/admin` | `AdminDashboardPage` | Admin |
| `/admin/uploads` | `InteractiveUploads` | Admin |
| `/admin/org-mapping` | `InteractiveOrgMapping` | Admin |
| `/admin/legend` | `InteractiveLegend` | Admin |
| `/profile` | `ProfileView` | Any |

## Key Files

- **`src/router.jsx`** — Route definitions, `AuthGuard`, `AuthenticatedLayout`, role-aware view wrappers.
- **`src/config/navigation.js`** — `viewPaths` (view-id to URL mapping) and `roleDefaultPaths` (role to default URL).

## How Navigation Works

All in-app navigation uses `useNavigate()` from `react-router-dom`:

```jsx
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();

// Simple navigation
navigate("/bm/leads");

// Navigate to entity detail
navigate(`/bm/leads/${leadId}`);

// Go back
navigate(-1);

// Using viewPaths for legacy view-id compatibility
import { viewPaths } from "../config/navigation";
navigate(viewPaths["bm-dashboard"]); // "/bm/summary"
```

## Auth Guard

All authenticated routes are wrapped in `AuthGuard` + `AppLayout`:
- Unauthenticated users are redirected to `/login`.
- After login, users are redirected to their role's default path.
- The `AppViewRoute` wrapper sets `mode` and `role` in `AppContext` based on the route.

## Adding a New Route

1. Add the route path and component to `src/router.jsx`.
2. Add an entry to `viewPaths` in `src/config/navigation.js` if the sidebar needs to reference it.
3. Add a sidebar nav item in `roleNav` in `src/config/navigation.js`.

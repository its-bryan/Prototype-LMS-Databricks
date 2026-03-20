export const roleDefaults = {
  bm: "bm-dashboard",
  gm: "gm-overview",
  admin: "admin-dashboard",
};

export const roleDefaultPaths = {
  bm: "/bm/summary",
  gm: "/gm/overview",
  admin: "/admin",
};

export const viewPaths = {
  "bm-dashboard": "/bm/summary",
  "bm-work": "/bm/work",
  "bm-leads": "/bm/leads",
  "bm-lead-detail": "/bm/leads/:leadId",
  "bm-todo": "/bm/tasks",
  "bm-task-detail": "/bm/tasks/:taskId",
  "bm-meeting-prep": "/bm/meeting-prep",
  "bm-leaderboard": "/bm/leaderboard",
  "gm-overview": "/gm/overview",
  "gm-todos": "/gm/work",
  "gm-meeting-prep": "/gm/meeting-prep",
  "gm-spot-check": "/gm/spot-check",
  "gm-activity-report": "/gm/activity-report",
  "gm-leaderboard": "/gm/leaderboard",
  "gm-leads": "/gm/leads",
  "gm-lead-detail": "/gm/leads/:leadId",
  "gm-task-detail": "/gm/tasks/:taskId",
  "admin-dashboard": "/admin",
  "admin-uploads": "/admin/uploads",
  "admin-org-mapping": "/admin/org-mapping",
  "admin-legend": "/admin/legend",
  "observatory": "/observatory",
  "obs-conversion": "/observatory/conversion",
  "obs-leads": "/observatory/leads",
  "obs-leaderboard": "/observatory/leaderboard",
  feedback: "/feedback",
  profile: "/profile",
};

export const roleNav = {
  bm: [
    { id: "bm-dashboard", label: "Summary", icon: "grid", sectionId: "dashboard" },
    { id: "bm-work", label: "Work", icon: "briefcase", sectionId: "work" },
    { id: "bm-meeting-prep", label: "Meeting Prep", icon: "columns", sectionId: "work", parentId: "bm-work" },
    { id: "bm-leaderboard", label: "Leaderboard", icon: "trophy", sectionId: "leaderboard", parentId: "bm-work" },
    { id: "bm-leads", label: "My Leads", icon: "list", sectionId: "lead-pipeline", parentId: "bm-work" },
    { id: "bm-todo", label: "Open Tasks", icon: "check-circle", sectionId: "open-tasks", parentId: "bm-work" },
    { id: "observatory", label: "Observatory Tower", icon: "bar-chart" },
    { id: "obs-conversion", label: "Conversion %", icon: "bar-chart", parentId: "observatory" },
    { id: "obs-leads", label: "Total Leads", icon: "list", parentId: "observatory" },
    { id: "obs-leaderboard", label: "Org Leaderboard", icon: "trophy", parentId: "observatory" },
    { id: "feedback", label: "Feature Request/Feedback", icon: "message-square" },
  ],
  gm: [
    { id: "gm-overview", label: "Summary", icon: "grid" },
    { id: "gm-leaderboard", label: "Team Leaderboard", icon: "trophy", parentId: "gm-overview" },
    { id: "gm-activity-report", label: "Activity Report", icon: "activity", parentId: "gm-overview" },
    { id: "gm-todos", label: "Work", icon: "briefcase", sectionId: "todos" },
    { id: "gm-meeting-prep", label: "Meeting Prep", icon: "columns", parentId: "gm-todos" },
    { id: "gm-spot-check", label: "Spot Check", icon: "eye", parentId: "gm-todos" },
    { id: "gm-leads", label: "My Leads", icon: "list", parentId: "gm-todos" },
    { id: "observatory", label: "Observatory Tower", icon: "bar-chart" },
    { id: "obs-conversion", label: "Conversion %", icon: "bar-chart", parentId: "observatory" },
    { id: "obs-leads", label: "Total Leads", icon: "list", parentId: "observatory" },
    { id: "obs-leaderboard", label: "Org Leaderboard", icon: "trophy", parentId: "observatory" },
    { id: "feedback", label: "Feature Request/Feedback", icon: "message-square" },
  ],
  admin: [
    { id: "admin-dashboard", label: "Dashboard", icon: "grid" },
    { id: "admin-uploads", label: "Data Upload", icon: "upload", parentId: "admin-dashboard" },
    { id: "admin-org-mapping", label: "Org Mapping", icon: "users", parentId: "admin-dashboard" },
    { id: "admin-legend", label: "Cancellation Reasons", icon: "book", parentId: "admin-dashboard" },
    { id: "observatory", label: "Observatory Tower", icon: "bar-chart" },
    { id: "obs-conversion", label: "Conversion %", icon: "bar-chart", parentId: "observatory" },
    { id: "obs-leads", label: "Total Leads", icon: "list", parentId: "observatory" },
    { id: "obs-leaderboard", label: "Org Leaderboard", icon: "trophy", parentId: "observatory" },
    { id: "feedback", label: "Feature Request/Feedback", icon: "message-square" },
  ],
};

// Hidden drill-down views (not shown in sidebar)
export const drillDownViews = ["bm-lead-detail", "bm-task-detail", "gm-lead-detail", "gm-task-detail"];

export const roleMeta = {
  bm: { label: "Branch View", shortLabel: "Branch", profileLabel: "Branch Manager" },
  gm: { label: "Manager View", shortLabel: "Manager", profileLabel: "General Manager" },
  admin: { label: "Admin", shortLabel: "Admin", profileLabel: "Admin" },
};

export const roleUsers = {
  bm: { name: "Jonathan Hoover", initials: "JH" },
  gm: { name: "Adam Frankel", initials: "AF" },
  admin: { name: "Leo Admin", initials: "LA" },
};

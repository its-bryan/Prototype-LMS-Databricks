export const roleDefaults = {
  bm: "bm-dashboard",
  gm: "gm-dashboard",
  admin: "admin-dashboard",
};

export const roleNav = {
  bm: [
    { id: "bm-dashboard", label: "Summary", icon: "grid", sectionId: "dashboard" },
    { id: "bm-leads", label: "My Leads", icon: "list", sectionId: "lead-pipeline" },
    { id: "bm-todo", label: "Open Tasks", icon: "check-circle", sectionId: "open-tasks" },
  ],
  gm: [
    { id: "gm-dashboard", label: "Dashboard", icon: "grid", sectionId: "dashboard" },
    { id: "gm-compliance", label: "Compliance", icon: "bar-chart", sectionId: "compliance" },
    { id: "gm-cancelled", label: "Cancelled Leads", icon: "x-circle", sectionId: "cancelled-leads" },
    { id: "gm-unused", label: "Unused Leads", icon: "list", sectionId: "unused-leads" },
    { id: "gm-review", label: "Lead Review", icon: "columns", sectionId: "lead-review" },
    { id: "gm-spot-check", label: "Spot Check", icon: "search", sectionId: "spot-check" },
  ],
  admin: [
    { id: "admin-dashboard", label: "Dashboard", icon: "grid" },
    { id: "admin-uploads", label: "Data Uploads", icon: "upload" },
    { id: "admin-org-mapping", label: "Org Mapping", icon: "users" },
    { id: "admin-legend", label: "Legend", icon: "book" },
  ],
};

// Hidden drill-down views (not shown in sidebar)
export const drillDownViews = ["bm-lead-detail", "bm-task-detail", "gm-review-detail"];

export const roleMeta = {
  bm: { label: "Branch View", shortLabel: "Branch", profileLabel: "Branch Manager" },
  gm: { label: "Manager View", shortLabel: "Manager", profileLabel: "General Manager" },
  admin: { label: "Admin", shortLabel: "Admin", profileLabel: "Admin" },
};

export const roleUsers = {
  bm: { name: "Sarah Chen", initials: "SC" },
  gm: { name: "Mike Torres", initials: "MT" },
  admin: { name: "Lisa Park", initials: "LP" },
};

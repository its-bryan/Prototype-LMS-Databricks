import { useEffect, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../../context/AppContext";
import { Bone } from "../DashboardSkeleton";

const InteractiveDashboard = lazy(() => import("./InteractiveDashboard"));
const InteractiveLeadDetail = lazy(() => import("./InteractiveLeadDetail"));
const InteractiveUploads = lazy(() => import("./InteractiveUploads"));
const InteractiveOrgMapping = lazy(() => import("./InteractiveOrgMapping"));
const InteractiveLegend = lazy(() => import("./InteractiveLegend"));
const InteractiveThreeColumn = lazy(() => import("./InteractiveThreeColumn"));
const InteractiveTaskDetail = lazy(() => import("./InteractiveTaskDetail"));
const InteractiveMeetingPrepPage = lazy(() => import("./InteractiveMeetingPrepPage"));
const InteractiveLeaderboardPage = lazy(() => import("./InteractiveLeaderboardPage"));
const InteractiveGMLeadsPage = lazy(() => import("./InteractiveGMLeadsPage"));
const InteractiveGMLeaderboardPage = lazy(() => import("./InteractiveGMLeaderboardPage"));
const InteractiveGMMeetingPrepPage = lazy(() => import("./InteractiveGMMeetingPrepPage"));
const InteractiveGMSpotCheckPage = lazy(() => import("./InteractiveGMSpotCheckPage"));
const InteractiveGMActivityReportPage = lazy(() => import("./InteractiveGMActivityReportPage"));
const ProfileView = lazy(() => import("../ProfileView"));

const viewComponents = {
  "bm-home": InteractiveDashboard,
  "bm-dashboard": InteractiveDashboard,
  "bm-leads": InteractiveDashboard,
  "bm-todo": InteractiveDashboard,
  "bm-lead-detail": InteractiveLeadDetail,
  "bm-task-detail": InteractiveTaskDetail,
  "bm-meeting-prep": InteractiveMeetingPrepPage,
  "bm-leaderboard": InteractiveLeaderboardPage,
  "gm-overview": InteractiveDashboard,
  "gm-business-metrics": InteractiveDashboard,
  "gm-team-performance": InteractiveDashboard,
  "gm-todos": InteractiveDashboard,
  "gm-meeting-prep": InteractiveGMMeetingPrepPage,
  "gm-task-detail": InteractiveTaskDetail,
  "gm-lead-detail": InteractiveLeadDetail,
  "gm-lead-review": InteractiveGMLeadsPage,
  "gm-spot-check": InteractiveGMSpotCheckPage,
  "gm-leaderboard": InteractiveGMLeaderboardPage,
  "gm-activity-report": InteractiveGMActivityReportPage,
  "admin-dashboard": InteractiveDashboard,
  "admin-uploads": InteractiveUploads,
  "admin-org-mapping": InteractiveOrgMapping,
  "admin-legend": InteractiveLegend,
  profile: ProfileView,
};

// Views that share the same scrollable page - use stable key to avoid remount/refresh
// Meeting Prep and Leaderboard are separate pages; Summary (dashboard) has Home, Work, My Leads + Open Tasks
const BM_MAIN_VIEWS = ["bm-home", "bm-dashboard", "bm-leads", "bm-todo"];
const GM_MAIN_VIEWS = ["gm-overview", "gm-todos", "gm-business-metrics", "gm-team-performance"];

function getShellKey(activeView) {
  if (BM_MAIN_VIEWS.includes(activeView)) return "bm-main";
  if (GM_MAIN_VIEWS.includes(activeView)) return "gm-main";
  return activeView;
}

export default function InteractiveShell() {
  const { activeView } = useApp();
  const ViewComponent = viewComponents[activeView];

  // Scroll to top when shell mounts (e.g. after login, refresh)
  useEffect(() => {
    window.scrollTo(0, 0);
    const root = document.getElementById("dashboard-scroll-root");
    if (root) root.scrollTo(0, 0);
  }, []);

  if (!ViewComponent) {
    return (
      <div className="h-full flex items-center justify-center text-[#6E6E6E]">
        Select a view from the sidebar.
      </div>
    );
  }

  const fallback = (
    <div className="px-8 py-8 space-y-4">
      <Bone className="h-6 w-48" />
      <div className="grid grid-cols-3 gap-3">
        <Bone className="h-24" /><Bone className="h-24" /><Bone className="h-24" />
      </div>
      <Bone className="h-48 w-full" />
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={getShellKey(activeView)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="h-full"
      >
        <div id="dashboard-scroll-root" className="px-8 py-4 lg:px-12 lg:py-4 h-full min-h-0 overflow-y-auto overscroll-none bg-[var(--neutral-50)]">
          <Suspense fallback={fallback}>
            <ViewComponent />
          </Suspense>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

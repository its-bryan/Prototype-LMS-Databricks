import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "../../context/AppContext";
import InteractiveDashboard from "./InteractiveDashboard";
import InteractiveLeadDetail from "./InteractiveLeadDetail";
import InteractiveUploads from "./InteractiveUploads";
import InteractiveOrgMapping from "./InteractiveOrgMapping";
import InteractiveLegend from "./InteractiveLegend";
import InteractiveThreeColumn from "./InteractiveThreeColumn";
import ProfileView from "../ProfileView";
import InteractiveTaskDetail from "./InteractiveTaskDetail";

const viewComponents = {
  "bm-dashboard": InteractiveDashboard,
  "bm-leads": InteractiveDashboard,
  "bm-todo": InteractiveDashboard,
  "bm-lead-detail": InteractiveLeadDetail,
  "bm-task-detail": InteractiveTaskDetail,
  "gm-dashboard": InteractiveDashboard,
  "gm-compliance": InteractiveDashboard,
  "gm-cancelled": InteractiveDashboard,
  "gm-unused": InteractiveDashboard,
  "gm-review": InteractiveDashboard,
  "gm-spot-check": InteractiveDashboard,
  "gm-review-detail": InteractiveThreeColumn,
  "admin-dashboard": InteractiveDashboard,
  "admin-uploads": InteractiveUploads,
  "admin-org-mapping": InteractiveOrgMapping,
  "admin-legend": InteractiveLegend,
  profile: ProfileView,
};

// Views that share the same scrollable page - use stable key to avoid remount/refresh
const SECTION_VIEW_KEYS = {
  bm: ["bm-dashboard", "bm-leads", "bm-todo"], // bm-task-detail is drill-down, separate key
  gm: ["gm-dashboard", "gm-compliance", "gm-cancelled", "gm-unused", "gm-review", "gm-spot-check"],
};

function getShellKey(activeView) {
  if (SECTION_VIEW_KEYS.bm.includes(activeView)) return "bm-main";
  if (SECTION_VIEW_KEYS.gm.includes(activeView)) return "gm-main";
  return activeView;
}

export default function InteractiveShell() {
  const { activeView } = useApp();
  const ViewComponent = viewComponents[activeView];

  if (!ViewComponent) {
    return (
      <div className="h-full flex items-center justify-center text-[#6E6E6E]">
        Select a view from the sidebar.
      </div>
    );
  }

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
        <div id="dashboard-scroll-root" className="px-8 py-8 lg:px-12 lg:py-10 h-full overflow-auto">
          <ViewComponent />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

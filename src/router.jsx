import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import LoginScreen from "./components/LoginScreen";
import LoadingScreen from "./components/LoadingScreen";
import { useApp } from "./context/AppContext";
import { useAuth } from "./context/AuthContext";

const BMSummaryPage = lazy(() => import("./components/interactive/BMSummaryPage"));
const BMWorkPage = lazy(() => import("./components/interactive/BMWorkPage"));
const BMLeadsPage = lazy(() => import("./components/interactive/BMLeadsPage"));
const BMTasksPage = lazy(() => import("./components/interactive/BMTasksPage"));
const GMOverviewPage = lazy(() => import("./components/interactive/GMOverviewPage"));
const GMWorkPage = lazy(() => import("./components/interactive/GMWorkPage"));
const AdminDashboardPage = lazy(() => import("./components/interactive/AdminDashboardPage"));
const InteractiveLeadDetail = lazy(() => import("./components/interactive/InteractiveLeadDetail"));
const InteractiveTaskDetail = lazy(() => import("./components/interactive/InteractiveTaskDetail"));
const InteractiveMeetingPrepPage = lazy(() => import("./components/interactive/InteractiveMeetingPrepPage"));
const InteractiveLeaderboardPage = lazy(() => import("./components/interactive/InteractiveLeaderboardPage"));
const InteractiveGMMeetingPrepPage = lazy(() => import("./components/interactive/InteractiveGMMeetingPrepPage"));
const InteractiveGMSpotCheckPage = lazy(() => import("./components/interactive/InteractiveGMSpotCheckPage"));
const InteractiveGMActivityReportPage = lazy(() => import("./components/interactive/InteractiveGMActivityReportPage"));
const InteractiveGMLeaderboardPage = lazy(() => import("./components/interactive/InteractiveGMLeaderboardPage"));
const InteractiveGMLeadsPage = lazy(() => import("./components/interactive/InteractiveGMLeadsPage"));
const InteractiveUploads = lazy(() => import("./components/interactive/InteractiveUploads"));
const InteractiveOrgMapping = lazy(() => import("./components/interactive/InteractiveOrgMapping"));
const InteractiveLegend = lazy(() => import("./components/interactive/InteractiveLegend"));
const ProfileView = lazy(() => import("./components/ProfileView"));

const roleHomePaths = {
  bm: "/bm/summary",
  gm: "/gm/overview",
  admin: "/admin",
};

function AppViewRoute({ role, Component }) {
  const { setMode, setRole } = useApp();

  useEffect(() => {
    setMode("interactive");
    if (role) {
      setRole(role);
    }
  }, [role, setMode, setRole]);

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Component />
    </Suspense>
  );
}

function BMLeadDetailRoute() {
  return <AppViewRoute role="bm" Component={InteractiveLeadDetail} />;
}

function GMLeadDetailRoute() {
  return <AppViewRoute role="gm" Component={InteractiveLeadDetail} />;
}

function BMTaskDetailRoute() {
  return <AppViewRoute role="bm" Component={InteractiveTaskDetail} />;
}

function GMTaskDetailRoute() {
  return <AppViewRoute role="gm" Component={InteractiveTaskDetail} />;
}

function LoginRoute() {
  const { loading, userProfile } = useAuth();
  const { role } = useApp();
  const destination = roleHomePaths[role] ?? "/login";

  if (loading) return <LoadingScreen />;
  if (userProfile && role && destination !== "/login") {
    return <Navigate to={destination} replace />;
  }
  return <LoginScreen />;
}

function AuthGuard({ children }) {
  const { loading, signingIn, userProfile } = useAuth();
  const { role } = useApp();

  if (loading || (signingIn && !userProfile)) {
    return <LoadingScreen />;
  }

  if (!userProfile || !role) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AuthenticatedLayout() {
  return (
    <AuthGuard>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AuthGuard>
  );
}

function RoleDefaultRedirect() {
  const { loading, userProfile } = useAuth();
  const { role } = useApp();
  const destination = roleHomePaths[role] ?? "/login";

  if (loading) return <LoadingScreen />;
  if (!userProfile || !role) return <Navigate to="/login" replace />;
  return <Navigate to={destination} replace />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginRoute /> },
  { path: "/", element: <RoleDefaultRedirect /> },
  {
    element: <AuthenticatedLayout />,
    children: [
      { path: "/bm/summary", element: <AppViewRoute role="bm" Component={BMSummaryPage} /> },
      { path: "/bm/work", element: <AppViewRoute role="bm" Component={BMWorkPage} /> },
      { path: "/bm/leads", element: <AppViewRoute role="bm" Component={BMLeadsPage} /> },
      { path: "/bm/leads/:leadId", element: <BMLeadDetailRoute /> },
      { path: "/bm/tasks", element: <AppViewRoute role="bm" Component={BMTasksPage} /> },
      { path: "/bm/tasks/:taskId", element: <BMTaskDetailRoute /> },
      { path: "/bm/meeting-prep", element: <AppViewRoute role="bm" Component={InteractiveMeetingPrepPage} /> },
      { path: "/bm/leaderboard", element: <AppViewRoute role="bm" Component={InteractiveLeaderboardPage} /> },
      { path: "/gm/overview", element: <AppViewRoute role="gm" Component={GMOverviewPage} /> },
      { path: "/gm/work", element: <AppViewRoute role="gm" Component={GMWorkPage} /> },
      { path: "/gm/meeting-prep", element: <AppViewRoute role="gm" Component={InteractiveGMMeetingPrepPage} /> },
      { path: "/gm/spot-check", element: <AppViewRoute role="gm" Component={InteractiveGMSpotCheckPage} /> },
      { path: "/gm/activity-report", element: <AppViewRoute role="gm" Component={InteractiveGMActivityReportPage} /> },
      { path: "/gm/leaderboard", element: <AppViewRoute role="gm" Component={InteractiveGMLeaderboardPage} /> },
      { path: "/gm/leads", element: <AppViewRoute role="gm" Component={InteractiveGMLeadsPage} /> },
      { path: "/gm/leads/:leadId", element: <GMLeadDetailRoute /> },
      { path: "/gm/tasks/:taskId", element: <GMTaskDetailRoute /> },
      { path: "/admin", element: <AppViewRoute role="admin" Component={AdminDashboardPage} /> },
      { path: "/admin/uploads", element: <AppViewRoute role="admin" Component={InteractiveUploads} /> },
      { path: "/admin/org-mapping", element: <AppViewRoute role="admin" Component={InteractiveOrgMapping} /> },
      { path: "/admin/legend", element: <AppViewRoute role="admin" Component={InteractiveLegend} /> },
      { path: "/profile", element: <AppViewRoute Component={ProfileView} /> },
    ],
  },
  { path: "*", element: <RoleDefaultRedirect /> },
]);

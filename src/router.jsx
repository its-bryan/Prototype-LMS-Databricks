import { Suspense, useEffect } from "react";
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import LoginScreen from "./components/LoginScreen";
import LoadingScreen from "./components/LoadingScreen";
import RouteErrorFallback from "./components/RouteErrorFallback";
import lazyWithRetry from "./utils/lazyWithRetry";
import { useApp } from "./context/AppContext";
import { useAuth } from "./context/AuthContext";

const BMSummaryPage = lazyWithRetry(() => import("./components/interactive/BMSummaryPage"));
const BMWorkPage = lazyWithRetry(() => import("./components/interactive/BMWorkPage"));
const BMLeadsPage = lazyWithRetry(() => import("./components/interactive/BMLeadsPage"));
const BMTasksPage = lazyWithRetry(() => import("./components/interactive/BMTasksPage"));
const GMOverviewPage = lazyWithRetry(() => import("./components/interactive/GMOverviewPage"));
const GMWorkPage = lazyWithRetry(() => import("./components/interactive/GMWorkPage"));
const AdminDashboardPage = lazyWithRetry(() => import("./components/interactive/AdminDashboardPage"));
const InteractiveLeadDetail = lazyWithRetry(() => import("./components/interactive/InteractiveLeadDetail"));
const InteractiveTaskDetail = lazyWithRetry(() => import("./components/interactive/InteractiveTaskDetail"));
const InteractiveMeetingPrepPage = lazyWithRetry(() => import("./components/interactive/InteractiveMeetingPrepPage"));
const InteractiveLeaderboardPage = lazyWithRetry(() => import("./components/interactive/InteractiveLeaderboardPage"));
const InteractiveGMMeetingPrepPage = lazyWithRetry(() => import("./components/interactive/InteractiveGMMeetingPrepPage"));
const InteractiveGMActivityReportPage = lazyWithRetry(() => import("./components/interactive/InteractiveGMActivityReportPage"));
const InteractiveGMLeaderboardPage = lazyWithRetry(() => import("./components/interactive/InteractiveGMLeaderboardPage"));
const InteractiveGMLeadsPage = lazyWithRetry(() => import("./components/interactive/InteractiveGMLeadsPage"));
const GMMeetingPrepAllWeeks = lazyWithRetry(() => import("./components/interactive/GMMeetingPrepAllWeeks"));
const InteractiveUploads = lazyWithRetry(() => import("./components/interactive/InteractiveUploads"));
const InteractiveOrgMapping = lazyWithRetry(() => import("./components/interactive/InteractiveOrgMapping"));
const InteractiveLegend = lazyWithRetry(() => import("./components/interactive/InteractiveLegend"));
const ProfileView = lazyWithRetry(() => import("./components/ProfileView"));
const ObservatoryConversionPage = lazyWithRetry(() => import("./components/interactive/ObservatoryConversionPage"));
const ObservatoryLeadsPage = lazyWithRetry(() => import("./components/interactive/ObservatoryLeadsPage"));
const ObservatoryLeaderboardPage = lazyWithRetry(() => import("./components/interactive/ObservatoryLeaderboardPage"));
const ObservatoryLandingPage = lazyWithRetry(() => import("./components/interactive/ObservatoryLandingPage"));
const FeedbackPage = lazyWithRetry(() => import("./components/interactive/FeedbackPage"));

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
  { path: "/login", element: <LoginRoute />, errorElement: <RouteErrorFallback /> },
  { path: "/", element: <RoleDefaultRedirect />, errorElement: <RouteErrorFallback /> },
  {
    element: <AuthenticatedLayout />,
    errorElement: <RouteErrorFallback />,
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
      { path: "/gm/meeting-prep/all", element: <AppViewRoute role="gm" Component={GMMeetingPrepAllWeeks} /> },
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
      { path: "/feedback", element: <AppViewRoute Component={FeedbackPage} /> },
      { path: "/observatory", element: <AppViewRoute Component={ObservatoryLandingPage} /> },
      { path: "/observatory/conversion", element: <AppViewRoute Component={ObservatoryConversionPage} /> },
      { path: "/observatory/leads", element: <AppViewRoute Component={ObservatoryLeadsPage} /> },
      { path: "/observatory/leaderboard", element: <AppViewRoute Component={ObservatoryLeaderboardPage} /> },
    ],
  },
  { path: "*", element: <RoleDefaultRedirect />, errorElement: <RouteErrorFallback /> },
]);

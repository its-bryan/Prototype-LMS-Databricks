import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { viewPaths } from "../../config/navigation";
import { GMDashboardPage } from "./InteractiveDashboard";

export default function GMOverviewPage() {
  const navigate = useNavigate();
  const navigateTo = useCallback((target) => {
    if (!target) return;
    if (target.startsWith("/")) {
      navigate(target);
      return;
    }
    const path = viewPaths[target];
    if (path && !path.includes(":")) {
      navigate(path);
    }
  }, [navigate]);
  return <GMDashboardPage navigateTo={navigateTo} />;
}

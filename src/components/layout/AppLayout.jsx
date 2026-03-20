import { useState, useEffect, useRef, useMemo } from "react";
import DemoTopBar from "./DemoTopBar";
import Sidebar from "./Sidebar";
import OnboardingTour from "../OnboardingTour";
import DataBanner from "./DataBanner";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { BM_ONBOARDING_STEPS, GM_ONBOARDING_STEPS } from "../../config/onboardingSteps";

const ONBOARDING_DONE_PREFIX = "leo_onboarding_done:";

export default function AppLayout({ children }) {
  const { userProfile, completeOnboarding } = useAuth();
  const { role } = useApp();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingReplay, setOnboardingReplay] = useState(false);
  const lastCheckedUserId = useRef(null);
  const mainRef = useRef(null);

  const onboardingSteps = useMemo(
    () => (role === "gm" ? GM_ONBOARDING_STEPS : BM_ONBOARDING_STEPS),
    [role]
  );

  // Scroll to top on page load/refresh (prevents browser scroll restoration)
  useEffect(() => {
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      mainRef.current?.scrollTo(0, 0);
      document.getElementById("dashboard-scroll-root")?.scrollTo(0, 0);
    };
    scrollToTop();
    const t = setTimeout(scrollToTop, 100);
    return () => clearTimeout(t);
  }, []);

  // Conditional launch: BM/GM first login when onboarding completion is absent.
  // Local marker is a fallback if backend completion write fails transiently.
  useEffect(() => {
    if ((role !== "bm" && role !== "gm") || !userProfile?.id) return;
    if (lastCheckedUserId.current === userProfile.id) return;
    lastCheckedUserId.current = userProfile.id;

    let localCompletedAt = null;
    try {
      localCompletedAt = localStorage.getItem(`${ONBOARDING_DONE_PREFIX}${userProfile.id}`);
    } catch {
      localCompletedAt = null;
    }

    if (userProfile.onboardingCompletedAt == null && localCompletedAt == null) {
      setOnboardingReplay(false);
      setOnboardingOpen(true);
    }
  }, [role, userProfile?.id, userProfile?.onboardingCompletedAt]);

  const handleOnboardingClose = () => setOnboardingOpen(false);
  const handleOnboardingComplete = async () => {
    if (!onboardingReplay) await completeOnboarding();
    setOnboardingOpen(false);
  };
  const handleOnboardingSkip = async () => {
    if (!onboardingReplay) await completeOnboarding();
    setOnboardingOpen(false);
  };
  const handleHelpClick = () => {
    setOnboardingReplay(true);
    setOnboardingOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <DemoTopBar onHelpClick={role === "bm" || role === "gm" ? handleHelpClick : undefined} />
      <DataBanner />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-white pl-6">
          {children}
        </main>
      </div>
      <OnboardingTour
        open={onboardingOpen}
        onClose={handleOnboardingClose}
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
        isReplay={onboardingReplay}
        steps={onboardingSteps}
      />
    </div>
  );
}

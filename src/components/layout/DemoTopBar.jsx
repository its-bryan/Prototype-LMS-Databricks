import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { roleDefaultPaths, viewPaths } from "../../config/navigation";

const BMDashboardInbox = lazy(() =>
  import("../interactive/InteractiveDashboard").then((m) => ({ default: m.BMDashboardInbox }))
);

export default function DemoTopBar({ onHelpClick }) {
  const navigate = useNavigate();
  const { role } = useApp();
  const { userProfile, signOut } = useAuth();
  const [inboxOpen, setInboxOpen] = useState(false);
  const panelRef = useRef(null);

  const directiveCount = 0;

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setInboxOpen(false);
      }
    }
    if (inboxOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inboxOpen]);

  const handleNavigate = (viewId) => {
    if (typeof viewId === "string" && viewId.startsWith("/")) {
      navigate(viewId);
      setInboxOpen(false);
      return;
    }
    const path = viewPaths[viewId];
    if (path && !path.includes(":")) {
      navigate(path);
    }
    setInboxOpen(false);
  };

  return (
    <div className="h-[52px] bg-[#1A1A1A] flex items-center px-6 shrink-0 relative z-50">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (role) {
              navigate(roleDefaultPaths[role] ?? "/login");
            }
          }}
          className="flex items-center hover:opacity-90 transition-opacity cursor-pointer"
          title="Back to dashboard"
          aria-label="Back to dashboard"
        >
          <img src="/hertz-logo.svg" alt="Hertz" className="h-7" />
        </button>
        <span className="text-white/40 text-xs">|</span>
        <span className="text-white/70 text-sm">LEO: Your Lead Management System</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {onHelpClick && (
          <button
            onClick={onHelpClick}
            data-onboarding="help-button"
            className="p-2 text-white/70 hover:text-[#FFD100] hover:bg-white/10 rounded-md transition-colors duration-200 cursor-pointer"
            title="Replay onboarding tour"
            aria-label="Replay onboarding tour"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        )}
        {role === "bm" && (
          <>
            {/* Plus (Create) button hidden for now - doesn't fully work */}
            <div ref={panelRef}>
              <button
                onClick={() => setInboxOpen((v) => !v)}
                data-onboarding="inbox-button"
                className="relative p-2 text-white/70 hover:text-white transition-colors duration-200 cursor-pointer"
                title="Inbox"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                {directiveCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#FFD100] text-[#272425] text-[10px] font-bold px-1">
                    {directiveCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {inboxOpen && (
                  <Motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className="absolute right-6 top-[52px] w-[720px] max-h-[480px] overflow-y-auto bg-white rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.2)] border border-[#E5E5E5] z-50"
                  >
                    <div className="p-5">
                      <Suspense fallback={<div className="py-8 text-center text-sm text-neutral-500">Loading inbox…</div>}>
                        <BMDashboardInbox navigateTo={handleNavigate} />
                      </Suspense>
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {userProfile && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
            <span className="text-white/70 text-xs hidden sm:inline">{userProfile.displayName}</span>
            <button
              onClick={signOut}
              className="p-2 text-white/70 hover:text-[#FFD100] hover:bg-white/10 rounded-md transition-colors duration-200 cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

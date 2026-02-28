import { motion, useReducedMotion } from "framer-motion";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { roleNav, roleMeta, roleUsers, drillDownViews } from "../../config/navigation";

const iconMap = {
  grid: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  "bar-chart": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  "x-circle": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  columns: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  upload: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  inbox: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  "check-circle": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  book: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  trophy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h14M9 3v2a3 3 0 003 3v0a3 3 0 003-3V3M5 3a2 2 0 00-2 2v1a4 4 0 004 4h0M19 3a2 2 0 012 2v1a4 4 0 01-4 4h0M7 10v1a5 5 0 005 5v0a5 5 0 005-5v-1M9 21h6M12 16v5" />
    </svg>
  ),
};

const SECTION_VIEW_IDS = {
  bm: ["bm-dashboard", "bm-leads", "bm-todo"],
  gm: ["gm-dashboard", "gm-compliance", "gm-cancelled", "gm-unused", "gm-review", "gm-spot-check"],
};

/** Derives initials from display name (e.g. "Sarah Chen" → "SC"). */
function getInitials(displayName) {
  if (!displayName || typeof displayName !== "string") return "?";
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const { role, activeView, scrollActiveView, sidebarCollapsed, navigateTo, toggleSidebar } = useApp();
  const isProfileActive = activeView === "profile";
  const reduceMotion = useReducedMotion();
  const { signOut, userProfile } = useAuth();
  const navItems = role ? roleNav[role] || [] : [];

  const isSectionView = role && SECTION_VIEW_IDS[role]?.includes(activeView);
  const resolvedActive = isSectionView && scrollActiveView
    ? scrollActiveView
    : drillDownViews.includes(activeView)
      ? activeView === "bm-task-detail"
        ? "bm-todo"
        : activeView.replace(/-detail$/, "").replace("bm-lead", "bm-leads")
      : activeView;

  return (
    <motion.div
      layout={!reduceMotion}
      initial={false}
      animate={{ width: sidebarCollapsed ? 56 : 176 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="bg-[#F8F8F8] border-r border-[#E5E5E5] flex flex-col shrink-0 overflow-hidden"
    >
      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="p-2.5 text-[#666666] hover:text-[#272425] self-end cursor-pointer transition-colors duration-200 hover:scale-110 active:scale-95"
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarCollapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          )}
        </svg>
      </button>

      {/* Nav items */}
      <nav className="flex-1 px-2 space-y-0.5 min-w-0" data-onboarding="sidebar-nav">
        {navItems.map((item, i) => {
          const isActive = resolvedActive === item.id;
          return (
            <motion.button
              key={item.id}
              layout={!reduceMotion}
              initial={false}
              onClick={() => navigateTo(item.id)}
              whileHover={!reduceMotion ? { x: 2, transition: { duration: 0.15 } } : {}}
              whileTap={!reduceMotion ? { scale: 0.98 } : {}}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                isActive
                  ? "bg-[#FFD100]/15 text-[#272425] font-semibold ring-1 ring-[#FFD100]/40"
                  : "text-[#666666] hover:bg-white/80 hover:text-[#272425]"
              }`}
              title={item.label}
            >
              <span className={`shrink-0 ${isActive ? "text-[#FFD100]" : ""}`}>{iconMap[item.icon]}</span>
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer — user, settings, logout */}
      <div className="border-t border-[#E5E5E5] mx-2 mt-auto" />
      <div className={`flex flex-col px-2 py-3 space-y-0.5 ${sidebarCollapsed ? "items-center" : ""}`}>
        {role && (
          <button
            onClick={() => navigateTo("profile")}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer ${
              isProfileActive ? "bg-[var(--hertz-primary)]/15 ring-1 ring-[var(--hertz-primary)]/40" : "hover:bg-white/80"
            } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
            title="View profile"
            aria-current={isProfileActive ? "page" : undefined}
          >
            <span className="w-6 h-6 rounded-full bg-[var(--hertz-primary)] text-[var(--hertz-black)] text-[10px] font-bold flex items-center justify-center shrink-0">
              {userProfile ? getInitials(userProfile.displayName) : roleUsers[role]?.initials}
            </span>
            {!sidebarCollapsed && (
              <span className="text-xs text-[var(--hertz-black)] font-medium truncate">
                {userProfile?.displayName ?? roleUsers[role]?.name}
              </span>
            )}
          </button>
        )}
        <button
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-[#666666] hover:bg-white/80 hover:text-[#272425] transition-colors cursor-pointer ${
            sidebarCollapsed ? "justify-center px-0" : ""
          }`}
          title="Settings"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!sidebarCollapsed && <span>Settings</span>}
        </button>
        <button
          onClick={() => signOut()}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-[#666666] hover:bg-white/80 hover:text-[#272425] transition-colors cursor-pointer ${
            sidebarCollapsed ? "justify-center px-0" : ""
          }`}
          title="Logout"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </motion.div>
  );
}

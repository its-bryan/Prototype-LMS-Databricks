import { createContext, useContext, useReducer, useCallback } from "react";

const AppContext = createContext(null);

const initialState = {
  mode: "interactive",
  role: null,
  sidebarCollapsed: false,
  journeyStarted: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_MODE": {
      const mode = action.payload;
      if (mode === "journey") {
        return { ...state, mode, journeyStarted: false };
      }
      return { ...state, mode };
    }
    case "SET_ROLE": {
      const role = action.payload;
      if (role === state.role) return state;
      return { ...state, role, journeyStarted: false };
    }
    case "SET_JOURNEY_STARTED":
      return { ...state, journeyStarted: action.payload };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "RESET_VIEW_STATE":
      // Compatibility shim during URL-routing migration: keep API, clear only journey-local state.
      return { ...state, journeyStarted: false };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setMode = useCallback((mode) => dispatch({ type: "SET_MODE", payload: mode }), []);
  const setRole = useCallback((role) => dispatch({ type: "SET_ROLE", payload: role }), []);
  const setJourneyStarted = useCallback((v) => dispatch({ type: "SET_JOURNEY_STARTED", payload: v }), []);
  const toggleSidebar = useCallback(() => dispatch({ type: "TOGGLE_SIDEBAR" }), []);
  const resetViewState = useCallback(() => dispatch({ type: "RESET_VIEW_STATE" }), []);

  return (
    <AppContext.Provider
      value={{
        ...state,
        setMode,
        setRole,
        setJourneyStarted,
        toggleSidebar,
        resetViewState,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

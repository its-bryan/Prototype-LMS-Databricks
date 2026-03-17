import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useApp } from "./AppContext";
import { roleUsers } from "../config/navigation";

const defaultAuthValue = {
  signIn: async () => {},
  signOut: async () => {},
  loading: false,
  userProfile: null,
  profileError: null,
  updateProfile: async () => {},
  completeOnboarding: async () => {},
};

const AuthContext = createContext(defaultAuthValue);

/** Auth is role-based (Landing → select role). No Supabase; userProfile comes from roleUsers. */
export function AuthProvider({ children }) {
  const { setRole, role } = useApp();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!role) {
      setUserProfile(null);
      return;
    }
    const demoUser = roleUsers[role];
    if (!demoUser) {
      setUserProfile(null);
      return;
    }
    setUserProfile({
      id: `demo-${role}`,
      role,
      displayName: demoUser.name,
      branch: null,
      phone: null,
      email: null,
      onboardingCompletedAt: new Date().toISOString(),
      avatarUrl: null,
      title: null,
    });
  }, [role]);

  const signIn = useCallback(async () => {}, []);
  const signOut = useCallback(async () => {
    setRole(null);
  }, [setRole]);
  const updateProfile = useCallback(async () => {}, []);
  const completeOnboarding = useCallback(async () => {}, []);

  return (
    <AuthContext.Provider value={{ signIn, signOut, loading, userProfile, profileError, updateProfile, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

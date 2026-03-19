import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useApp } from "./AppContext";

const API_BASE = "/api";
const TOKEN_KEY = "leo_token";

const defaultAuthValue = {
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
  completeOnboarding: async () => {},
  loading: true,
  userProfile: null,
  profileError: null,
};

const AuthContext = createContext(defaultAuthValue);

function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch { /* private browsing */ }
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* ok */ }
}

function profileFromApi(u) {
  return {
    id: u.id,
    role: u.role,
    displayName: u.displayName,
    branch: u.branch ?? null,
    email: u.email ?? null,
    phone: null,
    onboardingCompletedAt: u.onboardingCompletedAt ?? u.onboarding_completed_at ?? null,
    avatarUrl: null,
    title: null,
  };
}

export function AuthProvider({ children }) {
  const { setRole } = useApp();
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          clearToken();
          setLoading(false);
          return;
        }
        const data = await res.json();
        const profile = profileFromApi(data.user);
        setUserProfile(profile);
        setRole(profile.role);
      } catch {
        clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email, password) => {
    setProfileError(null);
    setSigningIn(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        setSigningIn(false);
        throw new Error(err.detail || "Invalid email or password");
      }
      const data = await res.json();
      storeToken(data.token);
      const profile = profileFromApi(data.user);
      setUserProfile(profile);
      setRole(profile.role);
      return profile;
    } catch (e) {
      throw e;
    } finally {
      setSigningIn(false);
    }
  }, [setRole]);

  const signOut = useCallback(async () => {
    clearToken();
    setSigningIn(false);
    setUserProfile(null);
    setRole(null);
  }, [setRole]);

  const updateProfile = useCallback(async (fields) => {
    const token = getStoredToken();
    const nextDisplayName = fields?.display_name ?? fields?.displayName;
    let updatedProfile = null;

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(fields ?? {}),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            updatedProfile = profileFromApi(data.user);
          }
        }
      } catch {
        // Fall back to optimistic local profile update.
      }
    }

    if (!updatedProfile) {
      setUserProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(nextDisplayName ? { displayName: nextDisplayName } : {}),
        };
      });
      return null;
    }

    setUserProfile(updatedProfile);
    return updatedProfile;
  }, []);

  const completeOnboarding = useCallback(async () => {
    const completedAt = new Date().toISOString();
    setUserProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, onboardingCompletedAt: completedAt };
    });

    const token = getStoredToken();
    if (!token) return;

    try {
      await fetch(`${API_BASE}/auth/onboarding/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completedAt }),
      });
    } catch {
      // Local completion marker is enough for demo flow.
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        updateProfile,
        completeOnboarding,
        loading,
        signingIn,
        userProfile,
        profileError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

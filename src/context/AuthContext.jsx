import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useApp } from "./AppContext";
import { maybeTriggerAuthRedirect, parseApiErrorResponse } from "../utils/apiErrors";

const API_BASE = "/api";
const TOKEN_KEY = "leo_token";
const ONBOARDING_DONE_PREFIX = "leo_onboarding_done:";

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

function withTokenQuery(url, token) {
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_token=${encodeURIComponent(token)}`;
}

function authHeaders(token, base = {}) {
  if (!token) return base;
  return {
    ...base,
    Authorization: `Bearer ${token}`,
    "X-Leo-Token": token,
  };
}

function setLocalOnboardingDone(userId, completedAt) {
  if (!userId) return;
  try {
    localStorage.setItem(`${ONBOARDING_DONE_PREFIX}${userId}`, completedAt || new Date().toISOString());
  } catch {
    // Local fallback is best-effort.
  }
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

async function fetchJsonOrThrow(url, options = {}, { triggerAuthRedirect = false } = {}) {
  const method = options.method ?? "GET";
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await parseApiErrorResponse(res, method, url);
    if (triggerAuthRedirect) maybeTriggerAuthRedirect(err);
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
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
        const data = await fetchJsonOrThrow(withTokenQuery(`${API_BASE}/auth/me`, token), {
          headers: authHeaders(token),
        }, { triggerAuthRedirect: true });
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
      const data = await fetchJsonOrThrow(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      storeToken(data.token);
      const profile = profileFromApi(data.user);
      setUserProfile(profile);
      setRole(profile.role);
      if (profile?.id && profile?.onboardingCompletedAt) {
        setLocalOnboardingDone(profile.id, profile.onboardingCompletedAt);
      }
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
        const data = await fetchJsonOrThrow(withTokenQuery(`${API_BASE}/auth/profile`, token), {
          method: "PATCH",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          body: JSON.stringify(fields ?? {}),
        }, { triggerAuthRedirect: true });
        if (data?.user) {
          updatedProfile = profileFromApi(data.user);
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
    const userId = userProfile?.id;
    setUserProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, onboardingCompletedAt: completedAt };
    });
    setLocalOnboardingDone(userId, completedAt);

    const token = getStoredToken();
    if (!token) return;

    try {
      await fetchJsonOrThrow(withTokenQuery(`${API_BASE}/auth/onboarding/complete`, token), {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ completedAt }),
      }, { triggerAuthRedirect: true });
    } catch {
      // Local completion marker is enough for demo flow.
    }
  }, [userProfile?.id]);

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

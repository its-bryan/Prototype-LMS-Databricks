import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useApp } from "./AppContext";

const API_BASE = "/api";
const TOKEN_KEY = "leo_token";

const defaultAuthValue = {
  signIn: async () => {},
  signOut: async () => {},
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
    onboardingCompletedAt: new Date().toISOString(),
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
    } catch (e) {
      setSigningIn(false);
      throw e;
    }
  }, [setRole]);

  const signOut = useCallback(async () => {
    clearToken();
    setSigningIn(false);
    setUserProfile(null);
    setRole(null);
  }, [setRole]);

  return (
    <AuthContext.Provider value={{ signIn, signOut, loading, signingIn, userProfile, profileError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

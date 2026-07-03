import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";

/**
 * AuthContext — Centralized authentication state for LevelBlue.
 *
 * Provides: user, role, authed, loadingSession, login, logout, setUser
 * Replaces scattered useState calls in App.jsx with a single source of truth.
 * Any component can access auth state via useAuth() without prop drilling.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState("admin");
  const [loadingSession, setLoadingSession] = useState(true);

  // Restore authenticated session on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingSession(false);
      return;
    }

    apiFetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired session");
        return res.json();
      })
      .then((userData) => {
        setUser(userData);
        setRole(userData.role === "super" ? "super" : "admin");
        setAuthed(true);
      })
      .catch((err) => {
        console.warn("Session restore failed:", err);
        localStorage.removeItem("token");
      })
      .finally(() => {
        setLoadingSession(false);
      });
  }, []);

  const login = useCallback((loginResponse) => {
    const { token, user: userData } = loginResponse;
    localStorage.setItem("token", token);
    setRole(userData.role === "super" ? "super" : "admin");
    setUser(userData);
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setAuthed(false);
    setUser(null);
    setRole("admin");
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, authed, role, loadingSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — Hook for consuming AuthContext in any component.
 * @returns {{ user, setUser, authed, role, loadingSession, login, logout }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
}

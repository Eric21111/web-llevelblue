/**
 * api.js — Centralized API client for LevelBlue
 *
 * Use `apiFetch` instead of `fetch` for all /api/ calls.
 * Automatically injects the Authorization header from localStorage.
 * Does NOT touch window.fetch, keeping third-party libraries safe.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Core fetch wrapper — automatically attaches auth token to /api/ requests.
 * @param {string} url - API endpoint (e.g. "/api/students")
 * @param {RequestInit} options - Standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...options.headers };

  if (token && url.startsWith("/api/")) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${BASE_URL}${url}`, { ...options, headers });
}

/**
 * Convenience helper — parses JSON and throws on non-2xx responses.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
export async function apiRequest(url, options = {}) {
  const res = await apiFetch(url, options);

  if (!res.ok) {
    let errorMessage = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      errorMessage = body.error || errorMessage;
    } catch {
      // Non-JSON error body, use the status text
    }
    throw new Error(errorMessage);
  }

  // 204 No Content — return null
  if (res.status === 204) return null;

  return res.json();
}

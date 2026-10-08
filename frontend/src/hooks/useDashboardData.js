import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../utils/api";

export const TEACHER_SOURCES = { students: "/api/students", risk: "/api/analytics/at-risk", sections: "/api/sections", content: "/api/curriculum" };
export const SCHOOL_SOURCES = { ...TEACHER_SOURCES, teachers: "/api/teachers", logs: "/api/system-logs" };

// Each source keeps its own error state: a failed request must never look like zero activity.
export function useDashboardData(sources) {
  const [state, setState] = useState({ data: {}, errors: {}, loading: true, refreshing: false, updatedAt: null });
  const request = useRef(null);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 15000);
    setState(previous => ({ ...previous, refreshing: true }));
    const entries = Object.entries(sources);
    const results = await Promise.allSettled(entries.map(async ([, url]) => {
      const response = await apiFetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Couldn’t load this information. Please try again.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response. Please try again.");
      return data;
    }));
    clearTimeout(timeout);
    if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
    const data = {};
    const errors = {};
    results.forEach((result, index) => {
      const key = entries[index][0];
      if (result.status === "fulfilled") data[key] = result.value;
      else errors[key] = "Couldn’t load this information. Please try again.";
    });
    setState({ data, errors, loading: false, refreshing: false, updatedAt: new Date() });
    request.current = null;
  }, [sources]);
  useEffect(() => {
    refresh();
    const refreshVisible = () => { if (!document.hidden) refresh(); };
    const timer = setInterval(refreshVisible, 30000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  return { ...state, refresh };
}

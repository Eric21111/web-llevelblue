import { useEffect, useRef } from "react";

/**
 * Call `callback` immediately, then on an interval, and whenever the tab
 * becomes visible again. Skips ticks while the document is hidden.
 */
export function useLivePoll(callback, intervalMs = 2000) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const run = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      callbackRef.current();
    };

    run();
    const timer = setInterval(run, intervalMs);
    const onWake = () => run();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [intervalMs]);
}

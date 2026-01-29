"use client";

import { useSyncExternalStore, useCallback } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  // On the server, assume online
  return true;
}

/**
 * Hook to track network connectivity status.
 * Uses the browser's `navigator.onLine` API with real-time event listeners.
 *
 * @returns `true` if online, `false` if offline
 *
 * @example
 * ```tsx
 * const isOnline = useOnlineStatus();
 * if (!isOnline) return <OfflineBanner />;
 * ```
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

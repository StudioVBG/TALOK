/**
 * useAutoBackup hook
 * Extracted from app/admin/plans/page.tsx
 */

import { useEffect, useRef } from "react";

export function useAutoBackup(data: unknown, key: string): Date | null {
  const lastBackup = useRef<Date | null>(null);

  useEffect(() => {
    if (!data || (typeof data === "object" && Object.keys(data as object).length === 0)) {
      return;
    }

    const backup = () => {
      try {
        localStorage.setItem(
          `${key}_backup`,
          JSON.stringify({
            data,
            timestamp: new Date().toISOString(),
          })
        );
        lastBackup.current = new Date();
      } catch (e) {
        console.error("Auto-backup failed:", e);
      }
    };

    // Backup every 30 seconds if there are changes
    const interval = setInterval(backup, 30000);

    // Backup before leaving the page
    const handleBeforeUnload = () => backup();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [data, key]);

  return lastBackup.current;
}

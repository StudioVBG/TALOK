"use client";

import { useEffect } from "react";

/**
 * One-time migration: rename localStorage keys from "lokatif-*" to "talok-*".
 * Runs once on first client-side load. Safe to remove after a few months.
 */
export function LocalStorageMigration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("lokatif-"));
    keys.forEach((k) => {
      const newKey = k.replace("lokatif-", "talok-");
      if (!localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, localStorage.getItem(k)!);
      }
      localStorage.removeItem(k);
    });
  }, []);

  return null;
}

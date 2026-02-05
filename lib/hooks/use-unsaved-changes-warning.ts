"use client";

import { useEffect } from "react";

/**
 * Warns the user before navigating away when there are unsaved form changes.
 * Attaches a `beforeunload` listener when `isDirty` is true.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        // Required for some browsers
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);
}

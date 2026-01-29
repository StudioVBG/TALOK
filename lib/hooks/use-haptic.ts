"use client";

import { useCallback } from "react";

type HapticStyle =
  | "light"    // Light tap (selection change, toggle)
  | "medium"   // Medium tap (button press, action confirmation)
  | "heavy"    // Strong tap (destructive action, payment confirmation)
  | "success"  // Success pattern
  | "warning"  // Warning pattern
  | "error";   // Error pattern

/**
 * Hook providing haptic feedback functions for native mobile apps (Capacitor).
 * Gracefully degrades to no-op on web/non-supported platforms.
 *
 * @example
 * ```tsx
 * const haptic = useHaptic();
 *
 * <Button onClick={() => { haptic("medium"); handleSubmit(); }}>
 *   Confirmer le paiement
 * </Button>
 * ```
 */
export function useHaptic() {
  const trigger = useCallback(async (style: HapticStyle = "medium") => {
    try {
      // Try Capacitor Haptics plugin first (native mobile)
      const { Haptics, ImpactStyle, NotificationType } = await import(
        "@capacitor/haptics"
      );

      switch (style) {
        case "light":
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case "medium":
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case "heavy":
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case "success":
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case "warning":
          await Haptics.notification({ type: NotificationType.Warning });
          break;
        case "error":
          await Haptics.notification({ type: NotificationType.Error });
          break;
      }
    } catch {
      // Capacitor not available — try Web Vibration API as fallback
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          const patterns: Record<HapticStyle, number | number[]> = {
            light: 10,
            medium: 25,
            heavy: 50,
            success: [15, 50, 15],
            warning: [30, 50, 30],
            error: [50, 30, 50, 30, 50],
          };
          navigator.vibrate(patterns[style]);
        }
      } catch {
        // No haptic support — silently ignore
      }
    }
  }, []);

  return trigger;
}

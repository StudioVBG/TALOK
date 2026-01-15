"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { firstLoginService } from "@/features/onboarding/services/first-login.service";

// Types
export interface OnboardingTooltipProps {
  featureKey: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  children: React.ReactNode;
  className?: string;
  profileId?: string;
  showOnce?: boolean;
  delay?: number;
}

// Position calculation
function getTooltipPosition(
  position: "top" | "bottom" | "left" | "right",
  triggerRect: DOMRect
) {
  const tooltipWidth = 280;
  const tooltipHeight = 120;
  const margin = 12;

  switch (position) {
    case "top":
      return {
        top: triggerRect.top - tooltipHeight - margin,
        left: triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2,
      };
    case "bottom":
      return {
        top: triggerRect.bottom + margin,
        left: triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2,
      };
    case "left":
      return {
        top: triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2,
        left: triggerRect.left - tooltipWidth - margin,
      };
    case "right":
      return {
        top: triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2,
        left: triggerRect.right + margin,
      };
  }
}

export function OnboardingTooltip({
  featureKey,
  title,
  description,
  position = "bottom",
  actionLabel,
  actionHref,
  onAction,
  children,
  className,
  profileId,
  showOnce = true,
  delay = 500,
}: OnboardingTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Vérifier si le tooltip a déjà été fermé
  useEffect(() => {
    if (showOnce) {
      firstLoginService.isTooltipDismissed(featureKey).then((dismissed) => {
        setIsDismissed(dismissed);
      });
    }
  }, [featureKey, showOnce]);

  // Calculer la position quand le tooltip est visible
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition(getTooltipPosition(position, rect));
    }
  }, [isVisible, position]);

  // Afficher après un délai
  useEffect(() => {
    if (!isDismissed && delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isDismissed, delay]);

  const handleDismiss = async () => {
    setIsVisible(false);
    setIsDismissed(true);

    if (profileId && showOnce) {
      await firstLoginService.dismissTooltip(profileId, featureKey);
    }
  };

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    if (actionHref) {
      window.location.href = actionHref;
    }
    handleDismiss();
  };

  if (isDismissed) {
    return <>{children}</>;
  }

  return (
    <div ref={triggerRef} className={cn("relative inline-block", className)}>
      {children}

      <AnimatePresence>
        {isVisible && (
          <>
            {/* Pulse indicator on the element */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-1 -right-1 z-10"
            >
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 items-center justify-center">
                  <Info className="w-2.5 h-2.5 text-white" />
                </span>
              </span>
            </motion.div>

            {/* Tooltip */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: position === "top" ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="fixed z-50 w-70"
              style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
              }}
            >
              <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-slate-700">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-medium text-slate-300">
                      Astuce
                    </span>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h4 className="text-sm font-semibold text-white mb-1">
                    {title}
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">{description}</p>

                  {(actionLabel || actionHref) && (
                    <Button
                      size="sm"
                      onClick={handleAction}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                    >
                      {actionLabel || "En savoir plus"}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>

                {/* Arrow */}
                <div
                  className={cn(
                    "absolute w-3 h-3 bg-slate-900 border border-slate-700 rotate-45",
                    position === "top" &&
                      "bottom-[-7px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
                    position === "bottom" &&
                      "top-[-7px] left-1/2 -translate-x-1/2 border-b-0 border-r-0",
                    position === "left" &&
                      "right-[-7px] top-1/2 -translate-y-1/2 border-l-0 border-b-0",
                    position === "right" &&
                      "left-[-7px] top-1/2 -translate-y-1/2 border-r-0 border-t-0"
                  )}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Composant simplifié pour les hints inline
export function InlineHint({
  children,
  hint,
  className,
}: {
  children: React.ReactNode;
  hint: string;
  className?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn("relative inline-flex items-center gap-1", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
          >
            <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs whitespace-normal">
              {hint}
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Hook pour gérer plusieurs tooltips
export function useOnboardingTooltips(profileId: string) {
  const [dismissedTooltips, setDismissedTooltips] = useState<Set<string>>(
    new Set()
  );

  const dismissTooltip = async (featureKey: string) => {
    setDismissedTooltips((prev) => new Set([...prev, featureKey]));
    await firstLoginService.dismissTooltip(profileId, featureKey);
  };

  const isTooltipDismissed = (featureKey: string) => {
    return dismissedTooltips.has(featureKey);
  };

  return {
    dismissTooltip,
    isTooltipDismissed,
  };
}

export default OnboardingTooltip;

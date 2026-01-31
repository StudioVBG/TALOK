"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Une erreur est survenue",
  description = "Impossible de charger les données. Veuillez réessayer.",
  onRetry,
  className,
}: ErrorStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !prefersReducedMotion;

  return (
    <motion.div
      initial={motionEnabled ? { opacity: 0, scale: 0.95 } : undefined}
      animate={motionEnabled ? { opacity: 1, scale: 1 } : undefined}
      transition={motionEnabled ? { duration: 0.3 } : undefined}
      className={cn("flex flex-col items-center justify-center py-12 px-4", className)}
      role="alert"
      aria-live="polite"
    >
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <motion.div
            initial={motionEnabled ? { scale: 0 } : undefined}
            animate={motionEnabled ? { scale: 1 } : undefined}
            transition={motionEnabled ? { delay: 0.1, type: "spring", stiffness: 200, damping: 15 } : undefined}
            className="relative mb-6"
          >
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-xl opacity-50" />
            <div className="relative bg-destructive/10 rounded-full p-6">
              <AlertCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
            </div>
          </motion.div>

          <motion.h3
            initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
            animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            transition={motionEnabled ? { delay: 0.2 } : undefined}
            className="text-lg font-semibold text-foreground mb-2"
          >
            {title}
          </motion.h3>

          <motion.p
            initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
            animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            transition={motionEnabled ? { delay: 0.3 } : undefined}
            className="text-sm text-muted-foreground max-w-sm text-center mb-6"
          >
            {description}
          </motion.p>

          {onRetry && (
            <motion.div
              initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
              animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
              transition={motionEnabled ? { delay: 0.4 } : undefined}
            >
              <Button onClick={onRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Réessayer
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}


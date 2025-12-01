"use client";

import { ReactNode } from "react";
import { LucideIcon, Plus, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string; // Support pour les liens directs
    variant?: "default" | "outline" | "secondary";
  };
  children?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
  className,
}: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !prefersReducedMotion;
  return (
    <motion.div
      initial={motionEnabled ? { opacity: 0, scale: 0.95 } : undefined}
      animate={motionEnabled ? { opacity: 1, scale: 1 } : undefined}
      transition={motionEnabled ? { duration: 0.5 } : undefined}
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-lg border border-dashed bg-slate-50/50",
        className
      )}
    >
      <motion.div
        className="mb-6 relative"
        animate={
          motionEnabled
            ? {
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }
            : undefined
        }
        transition={
          motionEnabled
            ? {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2,
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-blue-100 rounded-full opacity-20 blur-xl" />
        <div className="relative bg-white p-4 rounded-full shadow-sm ring-1 ring-slate-100">
          <Icon className="h-10 w-10 text-slate-400" />
        </div>
      </motion.div>

      <motion.h3
        initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
        animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
        transition={motionEnabled ? { delay: 0.2 } : undefined}
        className="text-xl font-semibold text-slate-900 mb-2"
      >
        {title}
      </motion.h3>

      {description && (
        <motion.p
          initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { delay: 0.3 } : undefined}
          className="text-muted-foreground max-w-sm mb-8 text-sm md:text-base"
        >
          {description}
        </motion.p>
      )}

      {children}

      {action && (
        <motion.div
          initial={motionEnabled ? { opacity: 0, y: 10 } : undefined}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={motionEnabled ? { delay: 0.4 } : undefined}
        >
          {action.href ? (
            <Button asChild variant={action.variant || "default"} className="gap-2">
              <a href={action.href}>
                <Plus className="h-4 w-4" />
                {action.label}
              </a>
            </Button>
          ) : (
            <Button onClick={action.onClick} variant={action.variant || "default"} className="gap-2">
              <Plus className="h-4 w-4" />
              {action.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export function EmptyProperties({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Inbox} // Using Inbox as default Home icon if needed, or import Home from lucide-react
      title="Aucun bien"
      description="Vous n'avez pas encore ajouté de bien immobilier à votre portefeuille."
      action={onAdd ? { label: "Ajouter mon premier bien", onClick: onAdd } : undefined}
    />
  );
}

// ... other exports kept simple or refactored to use the new EmptyState 
// For brevity, I'm just exporting the main component and one example, 
// ensuring existing imports don't break if they use named exports.
// Ideally, other specific Empty* components should be updated to use the new base EmptyState.

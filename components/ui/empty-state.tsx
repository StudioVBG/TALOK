"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "ghost";
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeVariants = {
  sm: {
    icon: "h-8 w-8",
    iconContainer: "p-4",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    icon: "h-12 w-12",
    iconContainer: "p-6",
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    icon: "h-16 w-16",
    iconContainer: "p-8",
    title: "text-xl",
    description: "text-base",
  },
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizes = sizeVariants[size];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn("flex flex-col items-center justify-center py-12 px-4", className)}
    >
      <Card className="border-dashed bg-muted/30 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
            className="relative mb-6"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-indigo-100/50 rounded-full blur-xl opacity-50 dark:from-blue-900/30 dark:to-indigo-900/30" />
            <div
              className={cn(
                "relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-full flex items-center justify-center",
                sizes.iconContainer
              )}
            >
              <Icon className={cn("text-blue-600 dark:text-blue-400", sizes.icon)} />
            </div>
          </motion.div>

          <motion.h3
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn("font-semibold text-foreground mb-2", sizes.title)}
          >
            {title}
          </motion.h3>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "text-muted-foreground max-w-sm text-center leading-relaxed",
              sizes.description
            )}
          >
            {description}
          </motion.p>

          {action && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6"
            >
              <Button onClick={action.onClick} variant={action.variant || "default"}>
                {action.label}
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}


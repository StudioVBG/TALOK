"use client";

/**
 * Bouton Copilot AI - Accès rapide à l'assistant
 * SOTA 2026 - Floating action button
 */

import { motion } from "framer-motion";
import { Sparkles, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAICommand } from "@/lib/hooks/use-ai-command";
import { cn } from "@/lib/utils";

interface AICopilotButtonProps {
  className?: string;
  variant?: "floating" | "inline" | "minimal";
  showLabel?: boolean;
}

export function AICopilotButton({
  className,
  variant = "floating",
  showLabel = false,
}: AICopilotButtonProps) {
  const { openChat } = useAICommand();

  // SOTA 2026: FAB floating masqué - intégré dans UnifiedFAB
  // Visible uniquement sur desktop pour éviter les doublons mobile
  if (variant === "floating") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              className={cn(
                // SOTA 2026: Hidden sur mobile, visible uniquement desktop
                "hidden lg:block fixed bottom-6 right-6 z-50",
                className
              )}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
            >
              <Button
                onClick={openChat}
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
                >
                  <Sparkles className="h-6 w-6" />
                </motion.div>
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="left" className="flex items-center gap-2">
            <span>Demander à Tom</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === "inline") {
    return (
      <Button
        onClick={openChat}
        variant="outline"
        className={cn("gap-2", className)}
      >
        <Sparkles className="h-4 w-4" />
        {showLabel && <span>Demander à Tom</span>}
        <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs hidden sm:inline">
          ⌘K
        </kbd>
      </Button>
    );
  }

  // Minimal
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={openChat}
            variant="ghost"
            size="icon"
            className={className}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <span>Demander à Tom (⌘K)</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default AICopilotButton;


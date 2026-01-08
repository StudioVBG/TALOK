"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { CheckCircle, PartyPopper, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface CelebrationProps {
  show: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  nextAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  type?: "success" | "milestone" | "complete";
}

export function Celebration({ 
  show, 
  onClose, 
  title, 
  subtitle, 
  nextAction,
  type = "success" 
}: CelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      
      // Lancer les confettis
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = type === "complete" 
        ? ["#22c55e", "#10b981", "#34d399"] // Vert pour completion
        : type === "milestone"
        ? ["#8b5cf6", "#a855f7", "#c084fc"] // Violet pour milestone
        : ["#3b82f6", "#60a5fa", "#93c5fd"]; // Bleu pour success

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();

      // Jouer un son de célébration (optionnel)
      try {
        const audio = new Audio("/sounds/success.mp3");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      } catch (e) {
        // Pas de son disponible
      }
    }
  }, [show, type]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const iconConfig = {
    success: { icon: CheckCircle, bg: "bg-blue-500", text: "text-blue-600" },
    milestone: { icon: Sparkles, bg: "bg-purple-500", text: "text-purple-600" },
    complete: { icon: PartyPopper, bg: "bg-green-500", text: "text-green-600" },
  };

  const config = iconConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icône animée */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className={cn(
                "w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6",
                config.bg
              )}
            >
              <Icon className="h-10 w-10 text-white" />
            </motion.div>

            {/* Titre */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-slate-900 mb-2"
            >
              {title}
            </motion.h2>

            {/* Sous-titre */}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-slate-600 mb-6"
              >
                {subtitle}
              </motion.p>
            )}

            {/* Boutons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col gap-3"
            >
              {nextAction && (
                nextAction.href ? (
                  <Button asChild size="lg" className={cn("w-full gap-2", config.bg, "hover:opacity-90")}>
                    <a href={nextAction.href}>
                      {nextAction.label}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={() => {
                      nextAction.onClick?.();
                      handleClose();
                    }}
                    className={cn("w-full gap-2", config.bg, "hover:opacity-90")}
                  >
                    {nextAction.label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )
              )}
              <Button variant="ghost" onClick={handleClose} className="text-slate-500">
                Fermer
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook pour utiliser facilement les célébrations
export function useCelebration() {
  const [celebrationState, setCelebrationState] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    nextAction?: { label: string; onClick?: () => void; href?: string };
    type?: "success" | "milestone" | "complete";
  }>({
    show: false,
    title: "",
  });

  const celebrate = (options: Omit<typeof celebrationState, "show">) => {
    setCelebrationState({ ...options, show: true });
  };

  const closeCelebration = () => {
    setCelebrationState((prev) => ({ ...prev, show: false }));
  };

  return {
    celebrate,
    celebrationProps: {
      ...celebrationState,
      onClose: closeCelebration,
    },
  };
}

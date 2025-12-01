"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Sparkles, CheckCircle2 } from "lucide-react";

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  color: string;
  rotation: number;
  size: number;
}

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
];

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    size: Math.random() * 8 + 4,
  }));
}

interface CelebrationProps {
  show: boolean;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
  duration?: number;
}

export function Celebration({
  show,
  title = "Félicitations !",
  subtitle = "Votre bien a été créé avec succès",
  onComplete,
  duration = 4000,
}: CelebrationProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (show) {
      // Générer les confettis
      setConfetti(generateConfetti(50));
      
      // Afficher le contenu après un court délai
      const contentTimeout = setTimeout(() => {
        setShowContent(true);
      }, 500);

      // Déclencher onComplete après la durée
      const completeTimeout = setTimeout(() => {
        onComplete?.();
      }, duration);

      return () => {
        clearTimeout(contentTimeout);
        clearTimeout(completeTimeout);
      };
    } else {
      setShowContent(false);
      setConfetti([]);
    }
  }, [show, duration, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confetti.map((piece) => (
              <motion.div
                key={piece.id}
                initial={{
                  y: -20,
                  x: `${piece.x}vw`,
                  rotate: 0,
                  opacity: 1,
                }}
                animate={{
                  y: "100vh",
                  rotate: piece.rotation + 720,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 3,
                  delay: piece.delay,
                  ease: "easeIn",
                }}
                style={{
                  position: "absolute",
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                }}
              />
            ))}
          </div>

          {/* Contenu central */}
          <AnimatePresence>
            {showContent && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 300 }}
                className="relative text-center px-8 py-12"
              >
                {/* Icône centrale */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                  className="mx-auto mb-6 relative"
                >
                  <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30">
                    <CheckCircle2 className="h-12 w-12 text-white" />
                  </div>
                  
                  {/* Sparkles autour */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0"
                  >
                    <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-400" />
                    <PartyPopper className="absolute -bottom-2 -left-2 h-6 w-6 text-pink-400" />
                  </motion.div>
                </motion.div>

                {/* Texte */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
                >
                  {title}
                </motion.h2>
                
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg text-muted-foreground"
                >
                  {subtitle}
                </motion.p>

                {/* Barre de progression */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: duration / 1000, ease: "linear" }}
                  className="mt-8 h-1 bg-primary/20 rounded-full overflow-hidden mx-auto w-48"
                >
                  <div className="h-full bg-primary rounded-full origin-left" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook pour déclencher facilement la célébration
export function useCelebration() {
  const [isShowing, setIsShowing] = useState(false);

  const celebrate = () => {
    setIsShowing(true);
  };

  const dismiss = () => {
    setIsShowing(false);
  };

  return {
    isShowing,
    celebrate,
    dismiss,
    CelebrationComponent: (props: Omit<CelebrationProps, "show">) => (
      <Celebration show={isShowing} onComplete={dismiss} {...props} />
    ),
  };
}


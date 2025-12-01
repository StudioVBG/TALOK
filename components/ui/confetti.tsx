"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  size: number;
}

interface ConfettiProps {
  trigger: boolean;
  duration?: number;
  particleCount?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#FF6B6B", // Rouge
  "#4ECDC4", // Turquoise
  "#45B7D1", // Bleu
  "#96E6A1", // Vert
  "#FFBE0B", // Jaune
  "#FB5607", // Orange
  "#8338EC", // Violet
  "#FF006E", // Rose
];

export function Confetti({
  trigger,
  duration = 3000,
  particleCount = 50,
  colors = DEFAULT_COLORS,
}: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      setIsActive(true);
      
      // Generate confetti pieces
      const newPieces: ConfettiPiece[] = Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        rotation: Math.random() * 360,
        size: Math.random() * 8 + 4,
      }));
      
      setPieces(newPieces);

      // Cleanup after duration
      const timer = setTimeout(() => {
        setPieces([]);
        setIsActive(false);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [trigger, isActive, particleCount, colors, duration]);

  return (
    <AnimatePresence>
      {pieces.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-[9999]">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{
                x: `${piece.x}vw`,
                y: "-10vh",
                rotate: piece.rotation,
                scale: 1,
              }}
              animate={{
                y: "110vh",
                rotate: piece.rotation + (Math.random() > 0.5 ? 720 : -720),
                scale: [1, 1.2, 0.8, 1],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.5 + Math.random(),
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className="absolute"
              style={{
                width: piece.size,
                height: piece.size * 1.5,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

// Hook pour déclencher le confetti
export function useConfetti() {
  const [trigger, setTrigger] = useState(false);

  const fire = () => {
    setTrigger(true);
    setTimeout(() => setTrigger(false), 100);
  };

  return { trigger, fire };
}


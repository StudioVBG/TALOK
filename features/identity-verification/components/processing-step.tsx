"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield, FileSearch, UserCheck } from "lucide-react";

interface ProcessingStepProps {
  onComplete?: () => void;
}

const PROCESSING_STEPS = [
  { icon: FileSearch, label: "Analyse du document...", duration: 2000 },
  { icon: UserCheck, label: "Vérification du visage...", duration: 2500 },
  { icon: Shield, label: "Validation des données...", duration: 1500 },
];

export function ProcessingStep({ onComplete }: ProcessingStepProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let totalProgress = 0;
    const totalDuration = PROCESSING_STEPS.reduce((sum, step) => sum + step.duration, 0);

    PROCESSING_STEPS.forEach((step, index) => {
      const stepStart = PROCESSING_STEPS.slice(0, index).reduce(
        (sum, s) => sum + s.duration,
        0
      );

      // Démarrer cette étape
      setTimeout(() => {
        setCurrentStep(index);
      }, stepStart);

      // Animation de progression pour cette étape
      const stepProgressInterval = setInterval(() => {
        totalProgress += 2;
        setProgress(Math.min((totalProgress / totalDuration) * 100, 100));
      }, step.duration / 50);

      setTimeout(() => {
        clearInterval(stepProgressInterval);
      }, stepStart + step.duration);
    });

    // Compléter après toutes les étapes
    const completeTimer = setTimeout(() => {
      setProgress(100);
      if (onComplete) {
        setTimeout(onComplete, 500);
      }
    }, totalDuration);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const CurrentIcon = PROCESSING_STEPS[currentStep]?.icon || Loader2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-6">
      {/* Animation principale */}
      <div className="relative mb-10">
        {/* Cercles de fond animés */}
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-500/10"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 160, height: 160, margin: "auto", left: -30, top: -30 }}
        />
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-500/5"
          animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          style={{ width: 200, height: 200, margin: "auto", left: -50, top: -50 }}
        />

        {/* Cercle principal avec icône */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-24 h-24 md:w-28 md:h-28 rounded-full bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center"
        >
          <motion.div
            key={currentStep}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <CurrentIcon className="w-10 h-10 md:w-12 md:h-12 text-emerald-400" />
          </motion.div>

          {/* Spinner autour */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(16, 185, 129, 0.2)"
              strokeWidth="4"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="289"
              initial={{ strokeDashoffset: 289 }}
              animate={{ strokeDashoffset: 289 - (289 * progress) / 100 }}
              transition={{ duration: 0.3 }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Texte de l'étape actuelle */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">
          {PROCESSING_STEPS[currentStep]?.label}
        </h2>
        <p className="text-slate-400">Veuillez patienter quelques instants</p>
      </motion.div>

      {/* Barre de progression globale */}
      <div className="w-full max-w-xs">
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-center text-slate-500 text-sm mt-3">
          {Math.round(progress)}% complété
        </p>
      </div>

      {/* Indicateurs d'étapes */}
      <div className="flex gap-2 mt-8">
        {PROCESSING_STEPS.map((_, index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              index <= currentStep ? "bg-emerald-500" : "bg-slate-700"
            }`}
            animate={index === currentStep ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.5, repeat: index === currentStep ? Infinity : 0 }}
          />
        ))}
      </div>
    </div>
  );
}


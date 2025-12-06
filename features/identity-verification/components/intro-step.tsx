"use client";

import { motion } from "framer-motion";
import { Shield, Clock, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IntroStepProps {
  onContinue: () => void;
  onSkip?: () => void;
}

export function IntroStep({ onContinue, onSkip }: IntroStepProps) {
  const reassurancePoints = [
    { icon: Shield, text: "Vos données sont chiffrées de bout en bout" },
    { icon: Clock, text: "Vérification en moins de 2 minutes" },
    { icon: Trash2, text: "Images supprimées après analyse" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-6 py-12">
      {/* Header avec animation fade-in */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">
          Vérifiez votre identité
        </h1>
        <p className="text-slate-400 text-lg max-w-md leading-relaxed">
          Une étape rapide pour sécuriser votre dossier locatif
        </p>
      </motion.div>

      {/* Illustration animée - 2 téléphones */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="flex gap-5 mb-10"
      >
        {/* Téléphone 1 - Selfie */}
        <div className="relative w-32 h-56 md:w-36 md:h-64 bg-slate-800/80 rounded-[2rem] border-4 border-slate-700 overflow-hidden shadow-2xl">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-slate-700 rounded-full" />
          <div className="absolute inset-4 flex items-center justify-center">
            <div className="relative w-16 h-16 md:w-20 md:h-20">
              {/* Cercle de scan animé externe */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-500/40"
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* Cercle principal */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500 flex items-center justify-center">
                <User className="w-8 h-8 md:w-10 md:h-10 text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Téléphone 2 - Document */}
        <div className="relative w-32 h-56 md:w-36 md:h-64 bg-slate-800/80 rounded-[2rem] border-4 border-slate-700 overflow-hidden shadow-2xl">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-slate-700 rounded-full" />
          <div className="absolute inset-4 flex items-center justify-center">
            {/* Représentation CNI */}
            <div className="w-20 h-14 md:w-24 md:h-16 border-2 border-slate-600 rounded-lg flex items-center gap-2 p-2 bg-slate-700/50">
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-500" />
              <div className="flex-1 space-y-1">
                <div className="h-1 md:h-1.5 bg-slate-500 rounded w-full" />
                <div className="h-1 md:h-1.5 bg-slate-500 rounded w-3/4" />
                <div className="h-1 md:h-1.5 bg-slate-500 rounded w-1/2" />
              </div>
            </div>
          </div>
          {/* Ligne de scan */}
          <motion.div
            className="absolute left-4 right-4 h-0.5 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
            animate={{ top: ["35%", "65%", "35%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>

      {/* Points de réassurance */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="space-y-3 mb-10 w-full max-w-sm"
      >
        {reassurancePoints.map((item, i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
            className="flex items-center gap-3 text-slate-300"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-sm">{item.text}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA Principal */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="w-full max-w-sm space-y-4"
      >
        <Button
          onClick={onContinue}
          className="w-full h-14 text-base font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-2xl shadow-lg shadow-white/10 transition-all duration-200 hover:shadow-xl hover:shadow-white/20"
        >
          Commencer la vérification
        </Button>

        {onSkip && (
          <Button
            onClick={onSkip}
            variant="ghost"
            className="w-full h-12 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl"
          >
            Plus tard
          </Button>
        )}

        <p className="text-center text-xs text-slate-500 px-4">
          En continuant, vous acceptez nos{" "}
          <a href="/legal/privacy" className="text-emerald-400 hover:underline">
            conditions de vérification d&apos;identité
          </a>
        </p>
      </motion.div>
    </div>
  );
}


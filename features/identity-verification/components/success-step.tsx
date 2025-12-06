"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExtractedIdentityData } from "../types";

interface SuccessStepProps {
  extractedData?: ExtractedIdentityData;
  onContinue: () => void;
}

export function SuccessStep({ extractedData, onContinue }: SuccessStepProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger confetti après un délai
    const timer = setTimeout(() => setShowConfetti(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Créer des confettis simples en CSS
  const confettiColors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#fbbf24", "#f59e0b"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-600 via-emerald-600 to-emerald-700 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Confettis animés */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: confettiColors[i % confettiColors.length],
                left: `${Math.random() * 100}%`,
                top: -10,
              }}
              initial={{ y: -10, opacity: 1, rotate: 0 }}
              animate={{
                y: window.innerHeight + 20,
                opacity: [1, 1, 0],
                rotate: Math.random() * 720 - 360,
                x: Math.random() * 200 - 100,
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Animation de succès principale */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
        className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white flex items-center justify-center mb-8 shadow-2xl shadow-emerald-900/30"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
        >
          <Check className="w-14 h-14 md:w-16 md:h-16 text-emerald-600" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Texte de succès */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Identité vérifiée !
        </h1>
        <p className="text-emerald-100 text-lg">
          Votre dossier locatif est maintenant sécurisé
        </p>
      </motion.div>

      {/* Récap données extraites */}
      {extractedData && (extractedData.nom || extractedData.prenom) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 w-full max-w-sm mb-8 border border-white/20"
        >
          <div className="flex items-center gap-2 mb-4 text-emerald-200">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">Informations vérifiées</span>
          </div>
          <div className="space-y-3">
            {extractedData.nom && (
              <div className="flex justify-between text-emerald-100">
                <span className="text-emerald-200/70">Nom</span>
                <span className="font-semibold text-white">{extractedData.nom}</span>
              </div>
            )}
            {extractedData.prenom && (
              <div className="flex justify-between text-emerald-100">
                <span className="text-emerald-200/70">Prénom</span>
                <span className="font-semibold text-white">{extractedData.prenom}</span>
              </div>
            )}
            {extractedData.date_naissance && (
              <div className="flex justify-between text-emerald-100">
                <span className="text-emerald-200/70">Né(e) le</span>
                <span className="font-semibold text-white">
                  {new Date(extractedData.date_naissance).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Badge de confiance */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex items-center gap-2 text-emerald-200/80 text-sm mb-8"
      >
        <Shield className="w-4 h-4" />
        <span>Vérification sécurisée et chiffrée</span>
      </motion.div>

      {/* Bouton continuer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <Button
          onClick={onContinue}
          className="w-full h-14 text-base font-semibold bg-white text-emerald-700 hover:bg-emerald-50 rounded-2xl shadow-lg shadow-emerald-900/30 transition-all duration-200"
        >
          Continuer
        </Button>
      </motion.div>
    </div>
  );
}


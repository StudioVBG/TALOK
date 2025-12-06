"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStepProps {
  errorCode?: string;
  errorMessage?: string;
  onRetry: () => void;
  onCancel: () => void;
  onHelp?: () => void;
}

const ERROR_MESSAGES: Record<string, { title: string; description: string; tip: string }> = {
  document_blurry: {
    title: "Document flou",
    description: "Le document capturé n'est pas assez net.",
    tip: "Assurez-vous d'avoir un bon éclairage et de tenir votre téléphone stable.",
  },
  document_expired: {
    title: "Document expiré",
    description: "Ce document n'est plus valide.",
    tip: "Veuillez utiliser un document en cours de validité.",
  },
  face_not_detected: {
    title: "Visage non détecté",
    description: "Nous n'avons pas pu détecter votre visage.",
    tip: "Placez votre visage au centre de l'écran dans un endroit bien éclairé.",
  },
  face_mismatch: {
    title: "Visage non correspondant",
    description: "Le visage ne correspond pas au document.",
    tip: "Assurez-vous que c'est bien votre document d'identité.",
  },
  document_unreadable: {
    title: "Document illisible",
    description: "Les informations du document n'ont pas pu être extraites.",
    tip: "Évitez les reflets et assurez-vous que tout le document est visible.",
  },
  network_error: {
    title: "Erreur de connexion",
    description: "La vérification n'a pas pu aboutir.",
    tip: "Vérifiez votre connexion internet et réessayez.",
  },
  default: {
    title: "Erreur de vérification",
    description: "Une erreur est survenue lors de la vérification.",
    tip: "Veuillez réessayer. Si le problème persiste, contactez le support.",
  },
};

export function ErrorStep({
  errorCode,
  errorMessage,
  onRetry,
  onCancel,
  onHelp,
}: ErrorStepProps) {
  const error = ERROR_MESSAGES[errorCode || "default"] || ERROR_MESSAGES.default;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center px-6 py-12">
      {/* Animation d'erreur */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-red-500/10 flex items-center justify-center mb-8"
      >
        <motion.div
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <AlertTriangle className="w-12 h-12 md:w-14 md:h-14 text-red-400" />
        </motion.div>
      </motion.div>

      {/* Texte d'erreur */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center mb-8 max-w-sm"
      >
        <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
          {error.title}
        </h2>
        <p className="text-slate-400 mb-4">
          {errorMessage || error.description}
        </p>
        
        {/* Tip */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-sm text-slate-300">
            💡 {error.tip}
          </p>
        </div>
      </motion.div>

      {/* Boutons d'action */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="w-full max-w-sm space-y-3"
      >
        <Button
          onClick={onRetry}
          className="w-full h-14 text-base font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-2xl"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Réessayer
        </Button>

        {onHelp && (
          <Button
            onClick={onHelp}
            variant="outline"
            className="w-full h-12 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            Besoin d&apos;aide ?
          </Button>
        )}

        <Button
          onClick={onCancel}
          variant="ghost"
          className="w-full h-12 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-xl"
        >
          <X className="w-4 h-4 mr-2" />
          Annuler
        </Button>
      </motion.div>
    </div>
  );
}


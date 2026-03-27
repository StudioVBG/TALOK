"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  Home,
  FileText,
  CreditCard,
  MessageSquare,
  ArrowRight,
  Rocket,
  ChevronRight,
  CheckCircle2,
  Building2,
  Key,
  Wrench,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onStartOnboarding: () => void;
  onSkipOnboarding: () => void;
  userName: string;
  role: UserRole;
}

// Configuration par rôle
const ROLE_CONFIG: Record<string, {
  emoji: string;
  title: string;
  subtitle: string;
  features: Array<{
    icon: React.ElementType;
    title: string;
    description: string;
  }>;
  ctaText: string;
  skipText: string;
}> = {
  owner: {
    emoji: "🏠",
    title: "Bienvenue sur Talok !",
    subtitle: "Gérez vos biens immobiliers en toute simplicité",
    features: [
      {
        icon: Building2,
        title: "Gérez vos biens",
        description: "Centralisez tous vos logements en un seul endroit",
      },
      {
        icon: FileText,
        title: "Baux numériques",
        description: "Créez et faites signer vos baux 100% en ligne",
      },
      {
        icon: CreditCard,
        title: "Encaissez vos loyers",
        description: "Recevez les paiements automatiquement",
      },
      {
        icon: Wrench,
        title: "Maintenance simplifiée",
        description: "Gérez les demandes d'intervention facilement",
      },
    ],
    ctaText: "Configurer mon espace",
    skipText: "Plus tard",
  },
  tenant: {
    emoji: "🔑",
    title: "Bienvenue sur Talok !",
    subtitle: "Votre espace locataire tout-en-un",
    features: [
      {
        icon: Home,
        title: "Votre logement",
        description: "Accédez à toutes les infos de votre location",
      },
      {
        icon: FileText,
        title: "Documents",
        description: "Signez votre bail et téléchargez vos quittances",
      },
      {
        icon: CreditCard,
        title: "Paiement facile",
        description: "Payez votre loyer en quelques clics",
      },
      {
        icon: MessageSquare,
        title: "Communication",
        description: "Échangez avec votre propriétaire simplement",
      },
    ],
    ctaText: "Compléter mon profil",
    skipText: "Explorer d'abord",
  },
  provider: {
    emoji: "🔧",
    title: "Bienvenue sur Talok !",
    subtitle: "Développez votre activité de prestataire",
    features: [
      {
        icon: Wrench,
        title: "Recevez des missions",
        description: "Des propriétaires vous contactent directement",
      },
      {
        icon: FileText,
        title: "Devis & Factures",
        description: "Gérez vos documents professionnels",
      },
      {
        icon: Shield,
        title: "Profil vérifié",
        description: "Gagnez la confiance des clients",
      },
      {
        icon: CreditCard,
        title: "Paiement sécurisé",
        description: "Recevez vos règlements facilement",
      },
    ],
    ctaText: "Créer mon profil pro",
    skipText: "Plus tard",
  },
  guarantor: {
    emoji: "🤝",
    title: "Bienvenue sur Talok !",
    subtitle: "Votre espace garant sécurisé",
    features: [
      {
        icon: Shield,
        title: "Engagement clair",
        description: "Comprenez vos obligations de garant",
      },
      {
        icon: FileText,
        title: "Documents",
        description: "Signez votre acte de cautionnement en ligne",
      },
      {
        icon: Home,
        title: "Suivi du bail",
        description: "Restez informé de la situation locative",
      },
      {
        icon: MessageSquare,
        title: "Communication",
        description: "Échangez avec le propriétaire si besoin",
      },
    ],
    ctaText: "Continuer",
    skipText: "Plus tard",
  },
  agency: {
    emoji: "🏢",
    title: "Bienvenue sur Talok !",
    subtitle: "Pilotez votre agence immobiliere",
    features: [
      {
        icon: Building2,
        title: "Mandats",
        description: "Gerez vos mandats de gestion et de location",
      },
      {
        icon: FileText,
        title: "Baux & Documents",
        description: "Creez et signez les baux pour vos proprietaires",
      },
      {
        icon: CreditCard,
        title: "Finances",
        description: "Suivez les loyers et commissions",
      },
      {
        icon: MessageSquare,
        title: "Communication",
        description: "Echangez avec proprietaires et locataires",
      },
    ],
    ctaText: "Configurer mon agence",
    skipText: "Plus tard",
  },
  admin: {
    emoji: "⚙️",
    title: "Bienvenue Administrateur !",
    subtitle: "Gerez la plateforme Talok",
    features: [],
    ctaText: "Acceder au tableau de bord",
    skipText: "Plus tard",
  },
  syndic: {
    emoji: "🏢",
    title: "Bienvenue sur Talok !",
    subtitle: "Gérez vos copropriétés efficacement",
    features: [
      {
        icon: Building2,
        title: "Copropriétés",
        description: "Centralisez la gestion de vos immeubles",
      },
      {
        icon: FileText,
        title: "Documents",
        description: "Gérez les tantièmes et assemblées",
      },
      {
        icon: CreditCard,
        title: "Comptabilité",
        description: "Suivez les charges et paiements",
      },
      {
        icon: Wrench,
        title: "Maintenance",
        description: "Coordonnez les interventions",
      },
    ],
    ctaText: "Configurer mon espace",
    skipText: "Plus tard",
  },
};

export function WelcomeModal({
  open,
  onClose,
  onStartOnboarding,
  onSkipOnboarding,
  userName,
  role,
}: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const config = ROLE_CONFIG[role];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
      },
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const handleSkip = () => {
    onSkipOnboarding();
    onClose();
  };

  const handleStart = () => {
    onStartOnboarding();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent hideClose className="sm:max-w-2xl p-0 overflow-hidden border-0 bg-transparent shadow-none" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Bienvenue sur Talok</DialogTitle>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden"
        >
          {/* Background effects - pointer-events-none to avoid blocking clicks */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>

          {/* Content */}
          <div className="relative z-10 p-6 sm:p-8">
            {/* Header */}
            <motion.div variants={itemVariants} className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25 mb-6"
              >
                <span className="text-4xl">{config.emoji}</span>
              </motion.div>

              <motion.h2
                variants={itemVariants}
                className="text-3xl sm:text-4xl font-bold text-white mb-3"
              >
                {config.title.replace(" !", ",")}
                <br />
                <span className="whitespace-nowrap">{userName}&nbsp;!</span>
              </motion.h2>

              <motion.p
                variants={itemVariants}
                className="text-lg text-slate-300"
              >
                {config.subtitle}
              </motion.p>
            </motion.div>

            {/* Features Grid */}
            {config.features.length > 0 && (
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
              >
                {config.features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className="group flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all">
                        <Icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white mb-1">
                          {feature.title}
                        </h4>
                        <p className="text-sm text-slate-300">
                          {feature.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* CTA Buttons */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Button
                onClick={handleStart}
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-blue-500/25 px-8"
              >
                <Rocket className="w-5 h-5 mr-2" />
                {config.ctaText}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <Button
                onClick={handleSkip}
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto text-slate-400 hover:text-white hover:bg-white/10 border border-white/20 rounded-lg px-4 py-2"
              >
                {config.skipText}
              </Button>
            </motion.div>

            {/* Progress hint */}
            <motion.p
              variants={itemVariants}
              className="text-center text-xs text-slate-400 mt-4"
            >
              <Sparkles className="w-3 h-3 inline-block mr-1" />
              Configuration rapide en quelques minutes
            </motion.p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeModal;

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Pizza04Icon,
  CommandFreeIcons,
  GlobalSearchIcon,
  AiCloudIcon,
  SmartPhone01Icon,
  CheckmarkCircle01Icon,
  DashboardSquare01Icon,
  MagicWandIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";

const FEATURES = [
  {
    id: "contrats",
    label: "Contrats de bail",
    icon: Pizza04Icon,
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200",
    description: "Créez et faites signer vos baux en quelques clics.",
  },
  {
    id: "loyers",
    label: "Encaissement loyers",
    icon: CommandFreeIcons,
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200",
    description: "Loyers encaissés par CB ou prélèvement automatique.",
  },
  {
    id: "edl",
    label: "États des lieux",
    icon: GlobalSearchIcon,
    image:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200",
    description: "EDL numériques, photos et signatures sur place.",
  },
  {
    id: "comptabilite",
    label: "Comptabilité",
    icon: CheckmarkCircle01Icon,
    image:
      "https://images.unsplash.com/photo-1554224154-26032ffc0d07?q=80&w=1200",
    description: "Export comptable en 1 clic pour votre déclaration.",
  },
  {
    id: "cloud",
    label: "Documents cloud",
    icon: AiCloudIcon,
    image:
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200",
    description: "Tous vos documents archivés et accessibles partout.",
  },
  {
    id: "mobile",
    label: "100% Mobile",
    icon: SmartPhone01Icon,
    image:
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=1200",
    description: "Gérez vos locations depuis votre téléphone.",
  },
  {
    id: "analytics",
    label: "Tableau de bord",
    icon: DashboardSquare01Icon,
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1200",
    description: "KPIs et rentabilité par bien, en temps réel.",
  },
  {
    id: "securite",
    label: "Sécurité renforcée",
    icon: CheckmarkCircle01Icon,
    image:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1200",
    description: "Données chiffrées, conformité RGPD garantie.",
  },
  {
    id: "automatisations",
    label: "Automatisations",
    icon: MagicWandIcon,
    image:
      "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1200",
    description: "Relances, reçus et alertes envoyés sans effort.",
  },
  {
    id: "outremer",
    label: "DROM compatibles",
    icon: CheckmarkCircle01Icon,
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200",
    description: "Diagnostics et règles spécifiques DOM-TOM inclus.",
  },
];

const AUTO_PLAY_INTERVAL = 3000;
const ITEM_HEIGHT = 65;

const wrap = (min: number, max: number, v: number) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

export function FeatureCarousel() {
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentIndex =
    ((step % FEATURES.length) + FEATURES.length) % FEATURES.length;

  const nextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const handleChipClick = (index: number) => {
    const diff = (index - currentIndex + FEATURES.length) % FEATURES.length;
    if (diff > 0) setStep((s) => s + diff);
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextStep, AUTO_PLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [nextStep, isPaused]);

  const getCardStatus = (index: number) => {
    const diff = index - currentIndex;
    const len = FEATURES.length;

    let normalizedDiff = diff;
    if (diff > len / 2) normalizedDiff -= len;
    if (diff < -len / 2) normalizedDiff += len;

    if (normalizedDiff === 0) return "active";
    if (normalizedDiff === -1) return "prev";
    if (normalizedDiff === 1) return "next";
    return "hidden";
  };

  return (
    <section id="fonctionnalites-carousel" className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center mb-10 md:mb-14">
        <span className="inline-block rounded-full bg-[#62B2FE]/10 px-3 py-1 text-xs font-semibold text-[#62B2FE] mb-4">
          Tout-en-un
        </span>
        <h2 className="font-display text-[28px] font-bold text-[#1B2A6B] sm:text-[32px] md:text-[40px]">
          Une plateforme, zéro prise de tête
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
          Contrats, loyers, états des lieux, comptabilité — tout est centralisé
          dans TALOK. Découvrez chaque fonctionnalité.
        </p>
      </div>

      <div className="w-full max-w-7xl mx-auto md:p-8">
        <div className="relative overflow-hidden rounded-[2.5rem] lg:rounded-[4rem] flex flex-col lg:flex-row min-h-[600px] lg:aspect-video border border-border/40">
          <div className="w-full lg:w-[40%] min-h-[350px] md:min-h-[450px] lg:h-full relative z-30 flex flex-col items-start justify-center overflow-hidden px-8 md:px-16 lg:pl-16 bg-[#62B2FE] ">
            <div className="absolute inset-x-0 top-0 h-12 md:h-20 lg:h-16 bg-gradient-to-b from-[#62B2FE] via-[#62B2FE]/80 to-transparent z-40" />
            <div className="absolute inset-x-0 bottom-0 h-12 md:h-20 lg:h-16 bg-gradient-to-t from-[#62B2FE] via-[#62B2FE]/80 to-transparent z-40" />
            <div className="relative w-full h-full flex items-center justify-center lg:justify-start z-20">
              {FEATURES.map((feature, index) => {
                const isActive = index === currentIndex;
                const distance = index - currentIndex;
                const wrappedDistance = wrap(
                  -(FEATURES.length / 2),
                  FEATURES.length / 2,
                  distance
                );

                return (
                  <motion.div
                    key={feature.id}
                    style={{
                      height: ITEM_HEIGHT,
                      width: "fit-content",
                    }}
                    animate={{
                      y: wrappedDistance * ITEM_HEIGHT,
                      opacity: 1 - Math.abs(wrappedDistance) * 0.25,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 90,
                      damping: 22,
                      mass: 1,
                    }}
                    className="absolute flex items-center justify-start"
                  >
                    <button
                      onClick={() => handleChipClick(index)}
                      onMouseEnter={() => setIsPaused(true)}
                      onMouseLeave={() => setIsPaused(false)}
                      className={cn(
                        "relative flex items-center gap-4 px-6 md:px-10 lg:px-8 py-3.5 md:py-5 lg:py-4 rounded-full transition-all duration-700 text-left group border",
                        isActive
                          ? "bg-white text-[#62B2FE] border-white z-10"
                          : "bg-transparent text-white/60 border-white/20 hover:border-white/40 hover:text-white"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center transition-colors duration-500",
                          isActive ? "text-[#62B2FE]" : "text-white/40"
                        )}
                      >
                        <HugeiconsIcon
                          icon={feature.icon}
                          size={18}
                          strokeWidth={2}
                        />
                      </div>

                      <span className="font-normal text-sm md:text-[15px] tracking-tight whitespace-nowrap uppercase">
                        {feature.label}
                      </span>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-[500px] md:min-h-[600px] lg:h-full relative bg-secondary/30 flex items-center justify-center py-16 md:py-24 lg:py-16 px-6 md:px-12 lg:px-10 overflow-hidden border-t lg:border-t-0 lg:border-l border-border/20">
            <div className="relative w-full max-w-[420px] aspect-[4/5] flex items-center justify-center">
              {FEATURES.map((feature, index) => {
                const status = getCardStatus(index);
                const isActive = status === "active";
                const isPrev = status === "prev";
                const isNext = status === "next";

                return (
                  <motion.div
                    key={feature.id}
                    initial={false}
                    animate={{
                      x: isActive ? 0 : isPrev ? -100 : isNext ? 100 : 0,
                      scale: isActive ? 1 : isPrev || isNext ? 0.85 : 0.7,
                      opacity: isActive ? 1 : isPrev || isNext ? 0.4 : 0,
                      rotate: isPrev ? -3 : isNext ? 3 : 0,
                      zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
                      pointerEvents: isActive ? "auto" : "none",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 260,
                      damping: 25,
                      mass: 0.8,
                    }}
                    className="absolute inset-0 rounded-[2rem] md:rounded-[2.8rem] overflow-hidden border-4 md:border-8 border-background bg-background origin-center"
                  >
                    <img
                      src={feature.image}
                      alt={feature.label}
                      className={cn(
                        "w-full h-full object-cover transition-all duration-700",
                        isActive
                          ? "grayscale-0 blur-0"
                          : "grayscale blur-[2px] brightness-75"
                      )}
                    />

                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute inset-x-0 bottom-0 p-10 pt-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end pointer-events-none"
                        >
                          <div className="bg-background text-foreground px-4 py-1.5 rounded-full text-[11px] font-normal uppercase tracking-[0.2em] w-fit shadow-lg mb-3 border border-border/50">
                            {index + 1} • {feature.label}
                          </div>
                          <p className="text-white font-normal text-xl md:text-2xl leading-tight drop-shadow-md tracking-tight">
                            {feature.description}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div
                      className={cn(
                        "absolute top-8 left-8 flex items-center gap-3 transition-opacity duration-300",
                        isActive ? "opacity-100" : "opacity-0"
                      )}
                    >
                      <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]" />
                      <span className="text-white/80 text-[10px] font-normal uppercase tracking-[0.3em] font-mono">
                        Live Session
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeatureCarousel;

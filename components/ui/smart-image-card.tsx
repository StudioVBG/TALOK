"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SmartImageCardProps {
  src?: string | null;
  alt: string;
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "outline" | "destructive" }>;
  title?: string;
  subtitle?: string;
  status?: React.ReactNode;
  aspectRatio?: "video" | "square" | "portrait" | "4/3";
  className?: string;
  priority?: boolean;
  overlayContent?: React.ReactNode;
}

export function SmartImageCard({
  src,
  alt,
  badges = [],
  title,
  subtitle,
  status,
  aspectRatio = "4/3", // Ratio par défaut plus vertical
  className,
  priority = false,
  overlayContent,
}: SmartImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const fallbackSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23e2e8f0' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E";
  const finalSrc = src || fallbackSrc;

  const aspectRatioClass = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    "4/3": "aspect-[4/3]",
  }[aspectRatio];

  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-xl bg-card border border-border/50 shadow-sm w-full",
        aspectRatioClass,
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: "var(--shadow-xl)" } as any}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* 1. Image avec Zoom Parallaxe */}
      <motion.div
        className="absolute inset-0 h-full w-full bg-muted"
        animate={{ scale: isHovered ? 1.05 : 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <Image
          src={finalSrc}
          alt={alt}
          fill
          className={cn(
            "object-cover transition-opacity duration-700",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setIsLoaded(true)}
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
        />
        
        {/* Gradient Overlay: Seulement sur le 1/3 bas pour la lisibilité */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-90 transition-opacity duration-300 group-hover:h-2/3" />
      </motion.div>

      {/* 2. Conteneur d'infos (Tout en bas) */}
      <div className="absolute bottom-0 left-0 right-0 p-5 z-30 flex flex-col justify-end h-full pointer-events-none">
        
        {/* Partie supérieure du contenu (Badges et Status) */}
        <div className="flex-1" /> {/* Spacer pour pousser le contenu en bas */}
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {/* Badges alignés */}
          <div className="flex flex-wrap gap-2 items-center">
             {status && (
                <div className="scale-90 origin-left">
                   {status}
                </div>
             )}
             {badges.map((badge, i) => (
              <Badge 
                key={i} 
                variant={badge.variant as any} 
                className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-0 font-medium px-2 py-0.5 h-6"
              >
                {badge.label}
              </Badge>
            ))}
          </div>

          {/* Titres */}
          <div>
            {subtitle && (
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 drop-shadow-md">
                {subtitle}
                </p>
            )}
            <h3 className="text-xl font-bold text-white leading-tight line-clamp-2 drop-shadow-lg shadow-black">
                {title}
            </h3>
          </div>
          
          {/* Barre décorative */}
          <motion.div 
            className="h-1 bg-primary rounded-full origin-left"
            initial={{ width: 0 }}
            animate={{ width: isHovered ? "100%" : "0%" }}
            transition={{ duration: 0.4 }}
          />
        </motion.div>
      </div>

      {/* 3. Overlay Action (Reste au centre mais discret) */}
      <AnimatePresence>
        {isHovered && overlayContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 pointer-events-auto"
          >
            {overlayContent}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

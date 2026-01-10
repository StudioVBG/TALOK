"use client";

/**
 * HeroSection - Section Hero SOTA 2025
 * 
 * Design distinctif avec:
 * - Typographie audacieuse (Satoshi ou Cabinet Grotesk)
 * - Dégradés dynamiques
 * - Animations orchestrées
 * - Effets de particules/grille
 * - Dark mode natif
 * 
 * Sources design:
 * - Linear.app landing page
 * - Vercel homepage
 * - Stripe patterns
 */

import React, { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  FileText,
  Shield,
  Sparkles,
  Check,
} from "lucide-react";
import Link from "next/link";
import { DemoVideoModalHero } from "@/components/marketing/DemoVideoModal";

interface HeroSectionProps {
  className?: string;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

const floatVariants = {
  initial: { y: 0 },
  animate: {
    y: [-10, 10, -10],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Composant grille de fond animée
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grille */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      
      {/* Glow orbs */}
      <motion.div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/20 blur-[120px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-500/20 blur-[120px]"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// Badges de features
const features = [
  { icon: Building2, text: "Gestion multi-biens" },
  { icon: FileText, text: "Baux automatiques" },
  { icon: Shield, text: "Signatures légales" },
];

export function HeroSection({ className }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={containerRef}
      className={cn(
        "relative min-h-[90vh] flex items-center justify-center overflow-hidden",
        className
      )}
    >
      <AnimatedGrid />

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="space-y-8"
        >
          {/* Badge */}
          <motion.div variants={itemVariants}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
              <Sparkles className="w-4 h-4" />
              Nouveau : Scoring IA de solvabilité
              <ArrowRight className="w-4 h-4" />
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight"
          >
            <span className="block text-foreground">Gérez vos locations</span>
            <span className="block mt-2 bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              en toute sérénité
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed"
          >
            La plateforme tout-en-un pour les propriétaires. 
            Baux automatiques, signatures électroniques, scoring locataires, 
            et quittances en un clic.
          </motion.p>

          {/* Feature badges */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-3"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50 text-sm"
                whileHover={{ scale: 1.05, backgroundColor: "hsl(var(--primary) / 0.1)" }}
                transition={{ duration: 0.2 }}
              >
                <feature.icon className="w-4 h-4 text-primary" />
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Button
              asChild
              size="lg"
              className="h-14 px-8 text-lg font-semibold rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              <Link href="/signup?role=owner">
                Créer mon premier bail
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            
            <DemoVideoModalHero />
          </motion.div>

          {/* Social proof */}
          <motion.div
            variants={itemVariants}
            className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-violet-500/80 border-2 border-background flex items-center justify-center text-xs font-bold text-white"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <span>+2,500 propriétaires actifs</span>
            </div>
            
            <div className="hidden sm:block w-px h-6 bg-border" />
            
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg
                    key={i}
                    className="w-4 h-4 text-amber-400 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
              <span>4.9/5 sur +500 avis</span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
          <motion.div
            className="w-1 h-2 rounded-full bg-muted-foreground/50"
            animate={{ y: [0, 12, 0], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}

// Export composants additionnels
export function FeatureGrid() {
  const features = [
    {
      icon: Building2,
      title: "Gestion multi-biens",
      description: "Gérez appartements, maisons, parkings et locaux commerciaux depuis une seule interface.",
    },
    {
      icon: FileText,
      title: "Baux automatiques",
      description: "Générez des baux conformes en quelques clics. Annexes et clauses légales incluses.",
    },
    {
      icon: Shield,
      title: "Signatures électroniques",
      description: "Signez vos baux en ligne avec valeur légale. Conforme eIDAS.",
    },
    {
      icon: Sparkles,
      title: "Scoring IA",
      description: "Analysez la solvabilité de vos candidats avec notre algorithme intelligent.",
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Une plateforme complète pour simplifier votre gestion locative au quotidien.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="group relative p-8 rounded-3xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/20 hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


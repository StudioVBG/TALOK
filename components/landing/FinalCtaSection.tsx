"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { fadeUp, stagger, ctaPulse, defaultViewport } from "@/lib/marketing/animations";

export function FinalCtaSection() {
  return (
    <motion.section
      className="relative overflow-hidden py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      {/* Gradient background — forced dark (spec exception) */}
      <div className="absolute inset-0 bg-[#1E293B]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(33,196,200,0.3),transparent_60%)]" />

      <motion.div
        className="container relative z-10 mx-auto max-w-3xl px-4 text-center"
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={defaultViewport}
      >
        <motion.h2
          variants={fadeUp}
          className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl"
        >
          Prêt à simplifier votre gestion locative ?
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-xl text-base font-normal leading-relaxed text-white/80"
        >
          Créez votre compte en 2 minutes. Gratuit, sans engagement, sans carte bancaire.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <motion.div variants={ctaPulse} animate="animate">
            <Button size="lg" className="bg-white text-[#1E293B] hover:bg-white/90" asChild>
              <Link href="/inscription">
                Commencer gratuitement
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
            <Link href="/demo">Demander une démo</Link>
          </Button>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

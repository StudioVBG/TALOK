"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles as SparklesIcon } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles";
import { ACCENT } from "./theme-classes";
import type { SolutionTheme } from "./types";

interface Props {
  theme: SolutionTheme;
  heading: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  reassurance?: string;
}

export function SolutionFinalCTA({
  theme,
  heading,
  description,
  primaryCta,
  secondaryCta,
  reassurance,
}: Props) {
  const a = ACCENT[theme.accent];

  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className={`relative overflow-hidden max-w-4xl mx-auto rounded-[2rem] border ${a.ctaBorder} bg-gradient-to-br ${a.ctaFromBg} via-slate-900/60 ${a.ctaToBg} p-10 md:p-14`}
        >
          <div className="absolute inset-0 opacity-40 pointer-events-none">
            <Sparkles
              className="absolute inset-0"
              color={theme.sparkleColor}
              density={300}
              size={1.2}
              speed={0.5}
              opacity={0.6}
            />
          </div>

          <div className="relative z-10 text-center">
            <SparklesIcon className={`w-12 h-12 ${a.iconText} mx-auto mb-5`} />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {heading}
            </h2>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              {description}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href={primaryCta.href}>
                <Button
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-slate-100 shadow-xl shadow-black/30"
                >
                  {primaryCta.label}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              {secondaryCta && (
                <Link href={secondaryCta.href}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white bg-slate-900/40 backdrop-blur-sm"
                  >
                    {secondaryCta.label}
                  </Button>
                </Link>
              )}
            </div>
            {reassurance && (
              <p className="mt-5 text-sm text-slate-400">{reassurance}</p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles";
import { blurUp, blurWord } from "@/components/marketing/hooks";
import { ACCENT } from "./theme-classes";
import type { SolutionTheme } from "./types";

interface Props {
  theme: SolutionTheme;
  badgeIcon: LucideIcon;
  badgeLabel: string;
  /** First half of the H1 */
  titleStart: string;
  /** Highlighted ending of the H1 (rendered with theme gradient) */
  titleEnd: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  reassurances: string[];
}

export function SolutionHero({
  theme,
  badgeIcon: BadgeIcon,
  badgeLabel,
  titleStart,
  titleEnd,
  description,
  primaryCta,
  secondaryCta,
  reassurances,
}: Props) {
  const startWords = titleStart.trim().split(" ");
  const a = ACCENT[theme.accent];

  return (
    <section className="relative pt-28 pb-20 overflow-hidden">
      {/* Particles backdrop */}
      <div className="absolute inset-0 -z-0 opacity-40">
        <Sparkles
          className="absolute inset-0"
          color={theme.sparkleColor}
          density={400}
          size={1.4}
          minSize={0.4}
          speed={0.4}
          opacity={0.7}
          opacitySpeed={2}
        />
      </div>

      {/* Radial glow */}
      <div
        className={`pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${a.radialFrom} via-transparent to-transparent`}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5 }}
          >
            <Badge
              className={`${a.badgeBg} ${a.badgeText} ${a.badgeBorder} mb-6`}
            >
              <BadgeIcon className="w-3 h-3 mr-1" />
              {badgeLabel}
            </Badge>
          </motion.div>

          <motion.h1
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
            initial="hidden"
            animate="visible"
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.05]"
          >
            {startWords.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                variants={blurWord(0)}
                className="mr-[0.25em] inline-block"
              >
                {word}
              </motion.span>
            ))}
            <br className="hidden md:block" />
            <motion.span
              variants={blurUp}
              className={`inline-block bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}
            >
              {titleEnd}
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            {description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex flex-wrap justify-center gap-4 mb-10"
          >
            <Link href={primaryCta.href}>
              <Button
                size="lg"
                className={`bg-gradient-to-r ${theme.gradient} text-white shadow-lg ${a.ctaButtonShadow} hover:opacity-90 transition-all ${a.ctaButtonShadowHover}`}
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
                  className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                >
                  {secondaryCta.label}
                </Button>
              </Link>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-slate-400"
          >
            {reassurances.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                {r}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

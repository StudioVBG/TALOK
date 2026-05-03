"use client";

import { motion } from "framer-motion";
import { useCountUp } from "@/components/marketing/hooks";
import { ACCENT } from "./theme-classes";
import type { SolutionStat, SolutionTheme } from "./types";

interface Props {
  stats: SolutionStat[];
  theme: SolutionTheme;
}

function StatItem({
  stat,
  theme,
  index,
}: {
  stat: SolutionStat;
  theme: SolutionTheme;
  index: number;
}) {
  const { ref, display } = useCountUp(stat.value, 1.4, {
    prefix: stat.prefix,
    suffix: stat.suffix,
  });
  const a = ACCENT[theme.accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 backdrop-blur-sm"
    >
      <div
        className={`absolute -top-12 -right-12 h-24 w-24 rounded-full ${a.statsGlowBg} blur-2xl`}
      />
      <stat.icon className={`mb-3 h-5 w-5 ${a.iconText}`} />
      <div className="text-3xl md:text-4xl font-bold text-white tabular-nums">
        <span ref={ref}>{display}</span>
      </div>
      <div className="mt-1 text-xs text-slate-400 leading-tight">
        {stat.label}
      </div>
    </motion.div>
  );
}

export function SolutionStats({ stats, theme }: Props) {
  return (
    <section className="py-12 -mt-4">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {stats.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} theme={theme} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

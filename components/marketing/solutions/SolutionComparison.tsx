"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { ACCENT } from "./theme-classes";
import type { SolutionComparisonRow, SolutionTheme } from "./types";

interface Props {
  heading: string;
  subheading?: string;
  rows: SolutionComparisonRow[];
  theme: SolutionTheme;
  withoutLabel?: string;
  withLabel?: string;
}

export function SolutionComparison({
  heading,
  subheading,
  rows,
  theme,
  withoutLabel = "Sans Talok",
  withLabel = "Avec Talok",
}: Props) {
  const a = ACCENT[theme.accent];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-3 text-slate-400">{subheading}</p>
          )}
        </motion.div>

        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-5xl mx-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm overflow-hidden"
        >
          <div className="grid grid-cols-3 border-b border-slate-700/50 text-xs font-semibold uppercase tracking-wider">
            <div className="p-4 text-slate-400">Sujet</div>
            <div className="p-4 text-center text-rose-300 bg-rose-500/5">
              <X className="inline-block w-3.5 h-3.5 mr-1" />
              {withoutLabel}
            </div>
            <div className={`p-4 text-center ${a.withHeaderText} ${a.withHeaderBg}`}>
              <Check className="inline-block w-3.5 h-3.5 mr-1" />
              {withLabel}
            </div>
          </div>

          {rows.map((row) => (
            <motion.div
              key={row.topic}
              variants={{
                hidden: { opacity: 0, x: -12 },
                visible: { opacity: 1, x: 0, transition: { duration: 0.45 } },
              }}
              className="grid grid-cols-3 border-b border-slate-700/30 last:border-b-0 hover:bg-slate-800/40 transition-colors"
            >
              <div className="p-4 text-sm font-medium text-white">
                {row.topic}
              </div>
              <div className="p-4 text-sm text-slate-400 leading-relaxed">
                {row.without}
              </div>
              <div className="p-4 text-sm text-slate-200 leading-relaxed">
                {row.with}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

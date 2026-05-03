"use client";

import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { ACCENT } from "./theme-classes";
import type { SolutionPainPoint, SolutionTheme } from "./types";

interface Props {
  heading: string;
  subheading?: string;
  items: SolutionPainPoint[];
  theme: SolutionTheme;
}

export function SolutionPainPoints({
  heading,
  subheading,
  items,
  theme,
}: Props) {
  const a = ACCENT[theme.accent];

  return (
    <section className="py-20 bg-slate-900/40">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="text-slate-400 max-w-2xl mx-auto">{subheading}</p>
          )}
        </motion.div>

        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {items.map((p) => (
            <motion.div
              key={p.title}
              variants={{
                hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
                visible: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.55 },
                },
              }}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 transition-all hover:border-slate-600 hover:shadow-xl hover:shadow-slate-900/50"
            >
              <div
                className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent ${a.hoverStripVia} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <p.icon className="h-6 w-6 text-red-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-3 leading-snug">
                {p.title}
              </h3>
              <div className="flex items-start gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                <Lightbulb className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-slate-200 leading-relaxed">
                  {p.solution}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

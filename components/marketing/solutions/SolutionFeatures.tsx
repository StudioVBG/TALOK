"use client";

import { motion } from "framer-motion";
import { ACCENT } from "./theme-classes";
import type { SolutionFeature, SolutionTheme } from "./types";

interface Props {
  heading: string;
  subheading?: string;
  features: SolutionFeature[];
  theme: SolutionTheme;
}

export function SolutionFeatures({
  heading,
  subheading,
  features,
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
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-4 text-slate-400">{subheading}</p>
          )}
        </motion.div>

        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
        >
          {features.map((feat) => (
            <motion.div
              key={feat.title}
              variants={{
                hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
                visible: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.5 },
                },
              }}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 transition-all hover:border-slate-600 hover:bg-slate-800/60 hover:shadow-xl hover:shadow-slate-900/50"
            >
              <div
                className={`pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full ${a.hoverGlowBg} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              <div
                className={`relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${a.iconBg} ring-1 ${a.iconRing} transition-all ${a.iconRingHover} group-hover:scale-110`}
              >
                <feat.icon className={`h-6 w-6 ${a.iconText}`} />
              </div>
              <h3 className="relative z-10 text-base font-semibold text-white mb-2 leading-snug">
                {feat.title}
              </h3>
              <p className="relative z-10 text-sm text-slate-400 leading-relaxed">
                {feat.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

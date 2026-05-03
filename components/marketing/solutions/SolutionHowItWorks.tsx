"use client";

import { motion } from "framer-motion";
import { ACCENT } from "./theme-classes";
import type { SolutionStep, SolutionTheme } from "./types";

interface Props {
  heading: string;
  subheading?: string;
  steps: SolutionStep[];
  theme: SolutionTheme;
}

export function SolutionHowItWorks({
  heading,
  subheading,
  steps,
  theme,
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
          className="text-center mb-14 max-w-2xl mx-auto"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Comment ça marche
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-white leading-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-4 text-slate-400">{subheading}</p>
          )}
        </motion.div>

        <div className="relative max-w-6xl mx-auto">
          <motion.div
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "left center" }}
            className={`hidden lg:block absolute top-12 left-12 right-12 h-px bg-gradient-to-r ${a.connectorFrom} ${a.connectorVia} to-transparent`}
          />

          <motion.div
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } },
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={{
                  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
                  visible: {
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: { duration: 0.5 },
                  },
                }}
                className="relative rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 hover:border-slate-600 hover:bg-slate-800/60 transition-all"
              >
                <div
                  className={`relative z-10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${a.stepGradient} text-base font-bold text-white shadow-lg ${a.stepShadow}`}
                >
                  {i + 1}
                </div>
                <step.icon className={`mx-auto mb-3 h-6 w-6 ${a.iconText}`} />
                <h3 className="text-center font-semibold text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-center text-sm text-slate-400 leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

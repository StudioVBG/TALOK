"use client";

import { motion } from "framer-motion";
import { blurUp } from "@/components/marketing/hooks";

interface Props {
  /** Short H2 above the long-form copy */
  heading: string;
  /** Sub-eyebrow above the H2 (e.g. "Bénéfice clé") */
  eyebrow?: string;
  /** Long-form paragraphs (2 to 4 recommended for SEO) */
  paragraphs: string[];
  /** Optional list of keywords rendered as small chips for SEO/visual interest */
  keywords?: string[];
}

export function SolutionSEOIntro({
  heading,
  eyebrow,
  paragraphs,
  keywords,
}: Props) {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-3xl mx-auto"
        >
          {eyebrow && (
            <motion.div variants={blurUp} className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                {eyebrow}
              </span>
            </motion.div>
          )}
          <motion.h2
            variants={blurUp}
            className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight"
          >
            {heading}
          </motion.h2>
          <div className="space-y-4 text-base md:text-lg text-slate-300 leading-relaxed">
            {paragraphs.map((p, i) => (
              <motion.p key={i} variants={blurUp}>
                {p}
              </motion.p>
            ))}
          </div>

          {keywords && keywords.length > 0 && (
            <motion.div
              variants={blurUp}
              className="mt-8 flex flex-wrap gap-2"
            >
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs text-slate-300"
                >
                  {k}
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { Quote, type LucideIcon } from "lucide-react";
import { ACCENT } from "./theme-classes";
import type { SolutionTestimonial, SolutionTheme } from "./types";

interface Props {
  testimonial: SolutionTestimonial;
  theme: SolutionTheme;
  avatarIcon: LucideIcon;
}

export function SolutionTestimonialCard({
  testimonial,
  theme,
  avatarIcon: AvatarIcon,
}: Props) {
  const a = ACCENT[theme.accent];

  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="relative max-w-3xl mx-auto rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-800/60 to-slate-900/60 p-8 md:p-12 backdrop-blur-sm"
        >
          <div
            className={`absolute -top-5 left-8 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${a.stepGradient} shadow-lg`}
          >
            <Quote className="h-5 w-5 text-white" fill="currentColor" />
          </div>

          <blockquote className="text-xl md:text-2xl text-white leading-relaxed mb-8 font-medium">
            « {testimonial.quote} »
          </blockquote>

          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${a.iconBg} ring-2 ${a.iconRing}`}
            >
              <AvatarIcon className={`h-6 w-6 ${a.iconText}`} />
            </div>
            <div>
              <div className="font-semibold text-white">{testimonial.author}</div>
              <div className="text-sm text-slate-400">
                {testimonial.location} · {testimonial.context}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

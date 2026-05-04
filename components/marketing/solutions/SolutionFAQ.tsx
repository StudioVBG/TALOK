"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { SolutionFAQItem } from "./types";
import { safeJsonLd } from "@/lib/seo/safe-json-ld";

interface Props {
  heading: string;
  subheading?: string;
  items: SolutionFAQItem[];
}

export function SolutionFAQ({ heading, subheading, items }: Props) {
  // JSON-LD FAQPage for SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className="py-20 bg-slate-900/40">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 max-w-2xl mx-auto"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Questions fréquentes
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-white leading-tight">
            {heading}
          </h2>
          {subheading && (
            <p className="mt-3 text-slate-400">{subheading}</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm divide-y divide-slate-700/40 overflow-hidden"
        >
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, i) => (
              <AccordionItem
                key={item.question}
                value={`faq-${i}`}
                className="border-b border-slate-700/40 last:border-b-0 px-5"
              >
                <AccordionTrigger className="py-4 text-left text-base font-semibold text-white hover:text-white hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 pt-1 text-sm text-slate-300 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

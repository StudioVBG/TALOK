'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { FeatureCard, FEATURE_CARDS } from './FeatureCard'

interface ArgumentsSectionProps {
  images: Record<string, string>
}

const headerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

export function ArgumentsSection({ images }: ArgumentsSectionProps) {
  return (
    <section className="bg-slate-50/60 py-20 md:py-28 dark:bg-slate-900/30">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <motion.div
          variants={headerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          className="mb-12 text-center"
        >
          <span className="inline-block rounded-full bg-[#2563EB]/10 px-4 py-1.5 text-sm font-semibold text-[#2563EB] mb-4">
            Pourquoi TALOK ?
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#1B2A6B] dark:text-white mb-3">
            Les résultats concrets de nos propriétaires
          </h2>
          <p className="mx-auto max-w-xl text-slate-500 dark:text-slate-400">
            Du temps retrouvé, des économies réelles, zéro paperasse. Voici ce qui change dès le premier mois.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="divide-y divide-slate-200/80 dark:divide-slate-700/40">
          {FEATURE_CARDS.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              imageSrc={
                images[feature.configKey] ||
                'https://images.unsplash.com/photo-1556761175-4b46a572b786?w=600&q=80'
              }
            />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-12 text-center"
        >
          <Link
            href="/pricing"
            className="group inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#2563EB]/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Voir les tarifs
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="mt-3 text-sm text-slate-400">
            Sans engagement · Résiliable à tout moment
          </p>
        </motion.div>
      </div>
    </section>
  )
}

"use client"

import { motion } from "framer-motion"
import { WorldMap } from "@/components/ui/map"
import type { MapDot } from "@/components/ui/map"
import { blurUp } from "@/components/marketing/hooks"

const mapConnections: MapDot[] = [
  {
    start: { lat: 48.8566, lng: 2.3522, label: "Paris" },
    end: { lat: 14.6415, lng: -61.0242, label: "Martinique", meta: "TVA : 8,5 % · Support local", labelBelow: true },
  },
  {
    start: { lat: 48.8566, lng: 2.3522, label: "Paris" },
    end: { lat: 16.265, lng: -61.551, label: "Guadeloupe", meta: "TVA : 8,5 %" },
  },
  {
    start: { lat: 48.8566, lng: 2.3522, label: "Paris" },
    end: { lat: 4.9372, lng: -52.326, label: "Guyane", meta: "TVA : 2,1 %", labelBelow: true },
  },
  {
    start: { lat: 48.8566, lng: 2.3522, label: "Paris" },
    end: { lat: -21.1151, lng: 55.5364, label: "Réunion", meta: "TVA : 8,5 %", labelBelow: true },
  },
  {
    start: { lat: 48.8566, lng: 2.3522, label: "Paris" },
    end: { lat: -12.8275, lng: 45.1662, label: "Mayotte", meta: "TVA : 0 %" },
  },
]

export function OutreMer() {
  return (
    <section className="relative overflow-hidden bg-black">
      {/* Header text — compact, above map */}
      <div className="relative z-20 pt-12 md:pt-16 pb-2 text-center px-4">
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.h2
            variants={blurUp}
            className="font-display text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-tight"
          >
            La France entière, DROM inclus.
          </motion.h2>

          <motion.p
            variants={blurUp}
            className="mt-3 mx-auto max-w-lg text-sm md:text-base leading-relaxed text-slate-400"
          >
            TVA, réglementations et diagnostics spécifiques à chaque territoire — intégrés nativement.
          </motion.p>
        </motion.div>
      </div>

      {/* Map */}
      <div className="relative z-10">
        <WorldMap
          dots={mapConnections}
          lineColor="#2563EB"
          animationDuration={2.5}
          forceDark
        />
      </div>
    </section>
  )
}

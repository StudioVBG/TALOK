"use client";

import { motion } from "framer-motion";
import { fadeUp, stagger, defaultViewport } from "@/lib/marketing/animations";

const CARDS = [
  {
    title: "Propriétaire rassuré",
    text: "Vision claire des loyers et des documents",
    gradient: "from-talok-bleu-marque/30 to-talok-cyan/20",
    large: true,
  },
  {
    title: "Gestionnaire efficace",
    text: "Demandes et suivis traités en un clic",
    gradient: "from-talok-vert/30 to-talok-cyan/20",
    large: false,
  },
  {
    title: "Locataire satisfait",
    text: "Paiement simple, réponses rapides",
    gradient: "from-talok-cyan/30 to-talok-bleu-marque/20",
    large: false,
  },
];

export function HumanSection() {
  return (
    <motion.section
      className="py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-talok-cyan/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-talok-cyan">
            Pensé pour de vraies personnes
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Derrière chaque clic, quelqu&apos;un qui gagne du temps.
          </h2>
          <p className="mt-4 text-base font-normal leading-relaxed text-muted-foreground">
            Talok n&apos;est pas un outil de plus. C&apos;est l&apos;assistant qui manquait
            aux propriétaires débordés, aux locataires qui veulent des réponses
            rapides, et aux gestionnaires qui veulent dormir tranquille.
          </p>
        </div>

        {/* Asymmetric grid: 1 large + 2 small */}
        <motion.div
          className="mt-14 grid gap-6 md:grid-cols-2"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
        >
          {/* Large card */}
          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl md:row-span-2 cursor-pointer"
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${CARDS[0].gradient}`} />
            <div className="relative flex h-full min-h-[320px] flex-col justify-end p-6 md:min-h-[400px]">
              <h3 className="font-display text-xl font-bold text-foreground">
                {CARDS[0].title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {CARDS[0].text}
              </p>
            </div>
          </motion.div>

          {/* Small cards */}
          {CARDS.slice(1).map((card) => (
            <motion.div
              key={card.title}
              variants={fadeUp}
              className="relative overflow-hidden rounded-2xl cursor-pointer"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
              <div className="relative flex min-h-[180px] flex-col justify-end p-6 md:min-h-[190px]">
                <h3 className="font-display text-lg font-bold text-foreground">
                  {card.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {card.text}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

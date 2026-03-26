"use client";

import { motion } from "framer-motion";
import { Lock, Scale, FileText, Shield } from "lucide-react";
import { fadeUp, stagger, defaultViewport } from "@/lib/marketing/animations";

const ITEMS = [
  {
    icon: Lock,
    title: "Données chiffrées",
    text: "Toutes vos informations sont chiffrées en transit et au repos. Personne n'y accède à part vous.",
  },
  {
    icon: Scale,
    title: "Conforme RGPD",
    text: "Talok respecte la réglementation européenne sur les données personnelles. Vos locataires aussi sont protégés.",
  },
  {
    icon: FileText,
    title: "Droit français respecté",
    text: "Baux, quittances, EDL, révision IRL — tout est conforme à la loi ALUR et aux règles en vigueur.",
  },
  {
    icon: Shield,
    title: "Paiements sécurisés",
    text: "Les paiements en ligne passent par un prestataire bancaire certifié. L'argent va directement sur votre compte.",
  },
];

export function ReassuranceSection() {
  return (
    <motion.section
      className="bg-secondary py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Vos données sont en sécurité. Votre conformité aussi.
        </h2>

        <motion.div
          className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
        >
          {ITEMS.map((item) => (
            <motion.div
              key={item.title}
              variants={fadeUp}
              className="rounded-2xl bg-card p-6 shadow-sm cursor-pointer"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-talok-bleu-marque/10">
                <item.icon className="h-6 w-6 text-talok-bleu-marque" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
}

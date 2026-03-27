"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { fadeUp, staggerWide, defaultViewport } from "@/lib/marketing/animations";

const CHECKS = [
  "Paiement en ligne par carte ou virement",
  "Relance automatique à J+3, J+7, J+15",
  "Quittances envoyées dès réception du loyer",
  "Rentabilité calculée par bien",
];

const BIENS = [
  { name: "T3 Fort-de-France", amount: "1 250 €", status: "Encaissé", color: "bg-emerald-500" },
  { name: "T2 Le Lamentin", amount: "890 €", status: "En attente", color: "bg-yellow-500" },
  { name: "T4 Schoelcher", amount: "1 450 €", status: "En retard", color: "bg-red-500" },
];

export function FeatureLoyers() {
  return (
    <motion.div
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
      variants={staggerWide}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      {/* Mockup left (inversé) */}
      <motion.div
        variants={fadeUp}
        className="order-2 lg:order-1 rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-semibold text-foreground">Mars 2026</h4>
          <span className="rounded-full bg-talok-vert/10 px-3 py-1 text-xs font-semibold text-talok-vert">
            92% encaissé
          </span>
        </div>

        {/* Summary bars */}
        <div className="mt-5 space-y-3">
          <SummaryBar label="Encaissés" amount="8 450 €" percentage={78} color="bg-emerald-500" />
          <SummaryBar label="En attente" amount="890 €" percentage={12} color="bg-yellow-500" />
          <SummaryBar label="En retard" amount="450 €" percentage={10} color="bg-red-500" />
        </div>

        {/* Property lines */}
        <div className="mt-6 divide-y divide-border">
          {BIENS.map((b) => (
            <div key={b.name} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.amount}/mois</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span className={`h-2 w-2 rounded-full ${b.color}`} />
                {b.status}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Text right */}
      <motion.div variants={fadeUp} className="order-1 lg:order-2">
        <span className="inline-block rounded-full bg-talok-vert/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-talok-vert">
          Suivi des loyers
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-foreground md:text-3xl">
          Voyez en un clin d&apos;œil qui a payé et qui est en retard
        </h3>
        <p className="mt-4 text-base font-normal leading-relaxed text-muted-foreground">
          Plus besoin de vérifier votre relevé bancaire ligne par ligne. Talok
          suit les paiements pour vous, envoie les relances automatiquement, et
          vous montre combien vous rapporte chaque bien.
        </p>
        <ul className="mt-6 space-y-3">
          {CHECKS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-talok-vert" />
              {c}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

function SummaryBar({
  label,
  amount,
  percentage,
  color,
}: {
  label: string;
  amount: string;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{amount}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

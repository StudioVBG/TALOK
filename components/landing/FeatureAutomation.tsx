"use client";

import { Check, Bell, FileText, AlertTriangle } from "lucide-react";

const CHECKS = [
  "Relances loyer par email et SMS",
  "Quittances envoyées automatiquement",
  "Alertes expiration (DPE, bail, assurance)",
  "Révision IRL calculée et proposée",
];

const AUTOMATIONS = [
  {
    icon: Bell,
    title: "Relance loyer J+3",
    description: "Email + SMS automatique",
    stat: "12 ce mois",
    color: "bg-talok-orange/10 text-talok-orange",
  },
  {
    icon: FileText,
    title: "Quittances mensuelles",
    description: "Envoi automatique dès paiement",
    stat: "8 envoyées",
    color: "bg-talok-vert/10 text-talok-vert",
  },
  {
    icon: AlertTriangle,
    title: "Alerte DPE",
    description: "Expiration prochaine",
    stat: "dans 47 jours",
    color: "bg-talok-bleu-marque/10 text-talok-bleu-marque",
  },
];

export function FeatureAutomation() {
  return (
    <div className="reveal grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Text */}
      <div>
        <span className="inline-block rounded-full bg-talok-cyan/10 px-3 py-1 text-xs font-semibold text-talok-cyan">
          Automatisation
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-foreground md:text-3xl">
          Tout ce qui peut tourner seul, tourne seul
        </h3>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Talok envoie les relances, génère les quittances, vous prévient quand
          un DPE expire ou quand un bail arrive à terme. Vous n&apos;avez plus à y
          penser.
        </p>
        <ul className="mt-6 space-y-3">
          {CHECKS.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-talok-cyan" />
              {c}
            </li>
          ))}
        </ul>
      </div>

      {/* Mockup: 3 automation cards */}
      <div className="space-y-4">
        {AUTOMATIONS.map((auto) => (
          <div
            key={auto.title}
            className="flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${auto.color}`}>
              <auto.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{auto.title}</p>
              <p className="text-xs text-muted-foreground">{auto.description}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-talok-vert" />
              <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                {auto.stat}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

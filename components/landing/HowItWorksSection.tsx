"use client";

import { Home, FileText, Rocket, Check } from "lucide-react";

const STEPS = [
  {
    number: "1",
    icon: Home,
    title: "Ajoutez vos biens",
    text: "Renseignez l'adresse, le type de logement et les infos clés. L'assistant vous guide pas à pas.",
    items: [
      "Appartement, maison, local commercial",
      "Photos, DPE, surface, équipements",
      "Codes postaux DROM-COM reconnus",
    ],
    color: "bg-talok-bleu-marque",
  },
  {
    number: "2",
    icon: FileText,
    title: "Créez vos baux",
    text: "Choisissez le type de bail, renseignez le loyer et les charges. Talok génère le contrat conforme automatiquement.",
    items: [
      "Bail vide, meublé, mobilité, commercial",
      "Signature électronique intégrée",
      "Conforme loi ALUR et droit local",
    ],
    color: "bg-talok-vert",
  },
  {
    number: "3",
    icon: Rocket,
    title: "Laissez tourner",
    text: "Quittances, relances, rappels — tout part automatiquement. Vous suivez vos loyers et votre rentabilité en temps réel.",
    items: [
      "Quittances envoyées chaque mois",
      "Relance automatique si retard",
      "Tableau de bord avec vos chiffres",
    ],
    color: "bg-talok-cyan",
  },
];

export function HowItWorksSection() {
  return (
    <section id="comment-ca-marche" className="bg-[hsl(var(--talok-gris-fond))] py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Opérationnel en 10 minutes, pas en 10 jours
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Trois étapes. Pas de formation. Pas de consultant. Vous créez votre
            compte et vous êtes parti.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="reveal rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${step.color}`}
                >
                  {step.number}
                </span>
                <step.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
              <ul className="mt-4 space-y-2">
                {step.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-talok-vert" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

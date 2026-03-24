"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Découverte",
    price: "0€",
    period: "gratuit sans limite",
    description: "Pour démarrer et tester à votre rythme",
    features: [
      "Jusqu'à 2 biens",
      "Création de baux",
      "Quittances manuelles",
      "Messagerie avec vos locataires",
      "Tableau de bord basique",
    ],
    cta: "Commencer gratuitement",
    href: "/inscription",
    featured: false,
  },
  {
    name: "Pro",
    price: "19,90€",
    period: "/mois",
    description: "Pour ceux qui veulent que ça tourne tout seul",
    badge: "Le plus choisi",
    features: [
      "Biens illimités",
      "Relances et quittances automatiques",
      "Paiement en ligne pour vos locataires",
      "Signature électronique",
      "Suivi rentabilité par bien",
      "État des lieux numérique",
      "Support prioritaire",
    ],
    cta: "Essayer 14 jours gratuit",
    href: "/inscription?plan=pro",
    featured: true,
  },
  {
    name: "Premium",
    price: "49,90€",
    period: "/mois",
    description: "Pour gérer plusieurs structures (SCI, SARL…)",
    features: [
      "Tout le plan Pro",
      "Multi-entités (SCI, SARL, SAS…)",
      "Module copropriété",
      "Export comptable",
      "Intégrations avancées",
      "Support dédié",
    ],
    cta: "Contacter l'équipe",
    href: "/contact",
    featured: false,
  },
];

export function PricingSection() {
  return (
    <section id="tarifs" className="py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="reveal mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Un prix simple. Pas de mauvaise surprise.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Commencez gratuitement avec 2 biens. Montez en gamme quand vous êtes
            prêt. Zéro engagement.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "reveal relative flex flex-col rounded-2xl border p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1",
                plan.featured
                  ? "border-talok-bleu-marque bg-white ring-2 ring-talok-bleu-marque/20"
                  : "bg-white"
              )}
            >
              {plan.badge && (
                <Badge className="absolute -top-3 left-6 bg-talok-bleu-marque text-white">
                  {plan.badge}
                </Badge>
              )}

              <h3 className="font-display text-xl font-bold text-foreground">
                {plan.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.description}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-talok-vert" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  "mt-8 w-full",
                  plan.featured
                    ? "bg-talok-bleu-marque text-white hover:bg-talok-bleu-marque/90"
                    : ""
                )}
                variant={plan.featured ? "default" : "outline"}
                asChild
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="reveal mt-8 text-center text-sm text-muted-foreground">
          Envie d&apos;économiser ? Le plan annuel Confort à 380 €/an vous offre 2
          mois gratuits.
        </p>
      </div>
    </section>
  );
}

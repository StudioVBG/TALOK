"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Gratuit",
    price: "0€",
    period: "gratuit sans limite",
    description: "Pour démarrer et tester à votre rythme",
    features: [
      "Jusqu'à 1 bien",
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
    name: "Confort",
    price: "35€",
    period: "/mois",
    description: "Pour ceux qui veulent que ça tourne tout seul",
    badge: "Recommandé",
    features: [
      "Jusqu'à 10 biens",
      "Relances et quittances automatiques",
      "Paiement en ligne pour vos locataires",
      "2 signatures électroniques/mois",
      "Suivi rentabilité par bien",
      "État des lieux numérique",
      "5 Go de stockage",
    ],
    cta: "1er mois offert",
    href: "/inscription?plan=confort",
    featured: true,
  },
  {
    name: "Pro",
    price: "69€",
    period: "/mois",
    description: "Pour les investisseurs et multi-biens",
    features: [
      "Jusqu'à 50 biens",
      "10 signatures électroniques/mois",
      "Multi-utilisateurs (5 comptes)",
      "Multi-entités (SCI, SARL, SAS…)",
      "Export comptable FEC",
      "30 Go de stockage",
      "Support prioritaire",
    ],
    cta: "1er mois offert",
    href: "/inscription?plan=pro",
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
                "reveal relative flex flex-col rounded-2xl border p-6",
                plan.featured
                  ? "border-2 border-[#2563EB] bg-white shadow-xl shadow-blue-500/10 ring-4 ring-[#2563EB]/10 scale-[1.02]"
                  : "bg-white shadow-sm"
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
          Envie d&apos;économiser ? Le plan annuel Confort à 336 €/an (−20%) vous offre 2 mois gratuits.
        </p>
      </div>
    </section>
  );
}

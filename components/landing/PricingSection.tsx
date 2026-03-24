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
    period: "pour toujours",
    description: "Pour démarrer et tester à votre rythme",
    features: [
      "1 bien",
      "Création de baux conformes",
      "Quittances manuelles",
      "Messagerie locataire",
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
    badge: "Le plus choisi",
    features: [
      "Jusqu'à 10 biens",
      "Relances et quittances automatiques",
      "Paiement en ligne",
      "2 signatures électroniques/mois",
      "Suivi rentabilité par bien",
      "État des lieux numérique",
      "Support prioritaire",
    ],
    cta: "Essayer 14 jours gratuit",
    href: "/inscription?plan=confort",
    featured: true,
  },
  {
    name: "Pro",
    price: "69€",
    period: "/mois",
    description: "Pour les investisseurs et gestionnaires (jusqu'à 50 biens)",
    features: [
      "Tout le plan Confort",
      "Jusqu'à 50 biens",
      "10 signatures/mois incluses",
      "Multi-entités (SCI, SARL…)",
      "Export comptable",
      "Support dédié",
    ],
    cta: "Essayer 14 jours gratuit",
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
            Commencez gratuitement. Montez en gamme quand vous êtes prêt.
            Zéro engagement.
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

        <div className="reveal mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <p>
            -20% sur l&apos;abonnement annuel. Besoin de gérer plus de 50 biens ?{" "}
            <Link href="/contact" className="font-medium text-talok-bleu-marque underline underline-offset-4">
              Contactez-nous pour une offre Enterprise
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

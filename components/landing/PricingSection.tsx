"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, formatPrice } from "@/lib/subscriptions/plans";

const DISPLAYED_PLANS: Array<{
  slug: "gratuit" | "confort" | "pro";
  cta: string;
  href: string;
}> = [
  {
    slug: "gratuit",
    cta: "Commencer gratuitement",
    href: "/signup/plan",
  },
  {
    slug: "confort",
    cta: "Essayer 1 mois gratuit",
    href: "/signup/plan?plan=confort",
  },
  {
    slug: "pro",
    cta: "Essayer 1 mois gratuit",
    href: "/signup/plan?plan=pro",
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
            Commencez gratuitement avec 1 bien. Montez en gamme quand vous êtes
            prêt. Zéro engagement.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {DISPLAYED_PLANS.map(({ slug, cta, href }) => {
            const plan = PLANS[slug];
            const isFeatured = plan.is_popular;
            const priceMonthly = plan.price_monthly;

            return (
              <div
                key={slug}
                className={cn(
                  "reveal relative flex flex-col rounded-2xl border p-6 shadow-sm",
                  isFeatured
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
                    {priceMonthly === 0
                      ? "Gratuit"
                      : formatPrice(priceMonthly)}
                  </span>
                  {priceMonthly !== null && priceMonthly > 0 && (
                    <span className="text-sm text-muted-foreground">/mois</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.description}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.highlights.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-talok-vert" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn(
                    "mt-8 w-full",
                    isFeatured
                      ? "bg-talok-bleu-marque text-white hover:bg-talok-bleu-marque/90"
                      : ""
                  )}
                  variant={isFeatured ? "default" : "outline"}
                  asChild
                >
                  <Link href={href}>{cta}</Link>
                </Button>
              </div>
            );
          })}
        </div>

        <p className="reveal mt-8 text-center text-sm text-muted-foreground">
          Envie d&apos;économiser ?{" "}
          Le plan annuel Confort à{" "}
          {formatPrice(PLANS.confort.price_yearly)}/an vous fait économiser 20%.
        </p>
      </div>
    </section>
  );
}

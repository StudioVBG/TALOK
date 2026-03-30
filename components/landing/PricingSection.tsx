"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeUp, stagger, ctaPulse, defaultViewport } from "@/lib/marketing/animations";
import { track } from "@/lib/analytics/posthog";
import { PLANS as PLAN_DATA, formatPrice } from "@/lib/subscriptions/plans";

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
    <motion.section
      id="tarifs"
      className="py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Un prix simple. Pas de mauvaise surprise.
          </h2>
          <p className="mt-4 text-base font-normal leading-relaxed text-muted-foreground">
            Commencez gratuitement avec 1 bien. Montez en gamme quand vous êtes
            prêt. Zéro engagement.
          </p>
        </div>

        <motion.div
          className="mt-14 grid gap-8 md:grid-cols-3"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
        >
          {DISPLAYED_PLANS.map(({ slug, cta, href }) => {
            const plan = PLAN_DATA[slug];
            const isFeatured = plan.is_popular;
            const priceMonthly = plan.price_monthly;

            return (
              <motion.div
                key={slug}
                variants={fadeUp}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-6 shadow-sm cursor-pointer",
                  isFeatured
                    ? "border-[#2563EB] bg-card ring-2 ring-[#2563EB]/20"
                    : "border-border bg-card"
                )}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                {plan.badge && (
                  <Badge className="absolute -top-3 left-6 bg-[#2563EB] text-white">
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

                {isFeatured ? (
                  <motion.div variants={ctaPulse} animate="animate" className="mt-8">
                    <Button
                      className="w-full bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                      asChild
                    >
                      <Link href={href} onClick={() => track("cta_pricing_plan_clicked", { plan: slug, source: "landing_pricing" })}>{cta}</Link>
                    </Button>
                  </motion.div>
                ) : (
                  <Button
                    className="mt-8 w-full"
                    variant="outline"
                    asChild
                  >
                    <Link href={href} onClick={() => track("cta_pricing_plan_clicked", { plan: slug, source: "landing_pricing" })}>{cta}</Link>
                  </Button>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Envie d&apos;économiser ?{" "}
          Le plan annuel Confort à{" "}
          {formatPrice(PLAN_DATA.confort.price_yearly)}/an vous fait économiser 20%.
        </p>
      </div>
    </motion.section>
  );
}

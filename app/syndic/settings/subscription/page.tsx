"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCoproSites } from "@/lib/hooks/use-copro-lots";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Check,
  Star,
  Zap,
  Crown,
  ExternalLink,
} from "lucide-react";

const SYNDIC_TIERS = [
  {
    id: "starter",
    name: "Starter",
    icon: Zap,
    perCopro: 3900,
    maxCopros: "< 5",
    features: [
      "Dashboard syndic",
      "Budget previsionnel",
      "Appels de fonds",
      "Cloture exercice",
      "5 annexes AG",
      "Extranet coproprietaires",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    icon: Star,
    perCopro: 3500,
    maxCopros: "5-14",
    popular: true,
    features: [
      "Tout Starter",
      "Import CSV lots",
      "Relances automatiques",
      "Rapprochement bancaire",
      "Documents personnalises",
      "Support prioritaire",
    ],
  },
  {
    id: "cabinet",
    name: "Cabinet",
    icon: Crown,
    perCopro: 2900,
    maxCopros: "15+",
    features: [
      "Tout Pro",
      "API access",
      "Multi-collaborateurs",
      "Marque blanche",
      "Webhook integrations",
      "Account manager dedie",
    ],
  },
] as const;

export default function SyndicSubscriptionPage() {
  const { data: sites } = useCoproSites();
  const coproCount = sites?.length ?? 0;

  const currentTier =
    coproCount >= 15 ? "cabinet" : coproCount >= 5 ? "pro" : "starter";
  const currentTierData = SYNDIC_TIERS.find((t) => t.id === currentTier)!;
  const monthlyTotal = coproCount * currentTierData.perCopro;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/syndic/settings"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Abonnement syndic
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Facturation au nombre de coproprietes gerees
          </p>
        </div>
      </div>

      {/* Current plan summary */}
      <Card className="border-cyan-200 dark:border-cyan-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/40">
                <currentTierData.icon className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    Plan {currentTierData.name}
                  </h3>
                  <Badge className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-0">
                    Actif
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {coproCount} copropriete{coproCount > 1 ? "s" : ""} geree
                  {coproCount > 1 ? "s" : ""} &middot;{" "}
                  {formatCents(currentTierData.perCopro)}/copro/mois
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">
                {formatCents(monthlyTotal)}
              </p>
              <p className="text-xs text-muted-foreground">par mois (HT)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SYNDIC_TIERS.map((tier) => {
          const isActive = tier.id === currentTier;
          const TierIcon = tier.icon;

          return (
            <Card
              key={tier.id}
              className={`relative overflow-hidden ${
                isActive
                  ? "ring-2 ring-cyan-500 border-cyan-500"
                  : "hover:border-cyan-200 dark:hover:border-cyan-800"
              } ${"popular" in tier && tier.popular ? "" : ""}`}
            >
              {"popular" in tier && tier.popular && (
                <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[10px] font-semibold px-3 py-1 rounded-bl-lg">
                  Populaire
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TierIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <CardTitle className="text-base">{tier.name}</CardTitle>
                </div>
                <CardDescription>{tier.maxCopros} coproprietes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {formatCents(tier.perCopro)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    par copropriete / mois
                  </p>
                </div>

                <ul className="space-y-2">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isActive ? (
                  <Badge className="w-full justify-center bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400 border-0 py-2">
                    Plan actuel
                  </Badge>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    {tier.id === "starter" && coproCount >= 5
                      ? "Vous avez depasse ce palier"
                      : tier.id === "cabinet" && coproCount < 15
                        ? `Ajoutez ${15 - coproCount} copro pour debloquer`
                        : "Degressivite automatique"}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Billing info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-600" />
            Facturation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-foreground">
                Mode de facturation
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Facturation mensuelle au nombre de coproprietes actives.
                Degressivite automatique.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-foreground">
                Prochaine facture
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {coproCount} copro x {formatCents(currentTierData.perCopro)} ={" "}
                <span className="font-semibold text-foreground">
                  {formatCents(monthlyTotal)}
                </span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-cyan-600">
            <ExternalLink className="w-4 h-4 mr-2" />
            Gerer le moyen de paiement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

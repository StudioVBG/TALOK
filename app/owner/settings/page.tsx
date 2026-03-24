"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, Lock, Palette, User, Wallet, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { getRequiredPlanForFeature, PLANS } from "@/lib/subscriptions/plans";

type SettingsCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  locked: boolean;
  lockedDescription?: string;
  requiredPlanName?: string;
};

const coreSettingsItems = [
  {
    title: "Mon profil",
    description: "Gérez vos informations personnelles et vos coordonnées",
    href: "/owner/profile",
    icon: User,
  },
  {
    title: "Moyens de paiement",
    description: "Configurez vos modes de paiement et encaissement",
    href: "/owner/money?tab=paiement",
    icon: Wallet,
  },
  {
    title: "Facturation",
    description: "Gérez votre abonnement et vos factures Talok",
    href: "/owner/money?tab=forfait",
    icon: CreditCard,
  },
];

const premiumSettingsItems = [
  {
    title: "Personnalisation",
    description: "Personnalisez l'apparence de vos documents",
    href: "/owner/settings/branding",
    icon: Palette,
    feature: "white_label" as const,
  },
];

export default function OwnerSettingsPage() {
  const { hasFeature } = useSubscription();

  const settingsItems: SettingsCard[] = [
    ...coreSettingsItems.map((item) => ({ ...item, locked: false })),
    ...premiumSettingsItems.map((item) => {
      const requiredPlan = getRequiredPlanForFeature(item.feature);
      const locked = !hasFeature(item.feature);

      return {
        ...item,
        locked,
        lockedDescription: locked
          ? `Disponible à partir du forfait ${PLANS[requiredPlan].name}.`
          : item.description,
        href: locked ? "/owner/money?tab=forfait" : item.href,
        requiredPlanName: PLANS[requiredPlan].name,
      };
    }),
  ];

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">
            Gérez votre compte et vos préférences selon votre forfait actuel
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {settingsItems.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card
                className={`h-full transition-all duration-200 ${
                  item.locked
                    ? "border-amber-200 bg-amber-50/40 hover:border-amber-300"
                    : "hover:border-blue-200 hover:shadow-md"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                      <item.icon className="h-5 w-5" />
                    </div>
                    {item.locked ? (
                      <Badge variant="outline" className="border-amber-300 bg-card text-amber-700">
                        <Lock className="mr-1 h-3 w-3" />
                        {item.requiredPlanName}
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription>
                    {item.locked ? item.lockedDescription : item.description}
                  </CardDescription>
                  <Button
                    variant={item.locked ? "outline" : "ghost"}
                    className="h-8 px-0 text-sm"
                  >
                    {item.locked ? "Voir le forfait requis" : "Ouvrir"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

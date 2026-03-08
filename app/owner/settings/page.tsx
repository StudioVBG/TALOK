"use client";

import Link from "next/link";
import { User, Wallet, CreditCard, Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";

const settingsItems = [
  {
    title: "Mon profil",
    description: "Gérez vos informations personnelles et vos coordonnées",
    href: "/owner/profile",
    icon: User,
  },
  {
    title: "Moyens de paiement",
    description: "Configurez vos modes de paiement et encaissement",
    href: "/owner/settings/payments",
    icon: Wallet,
  },
  {
    title: "Facturation",
    description: "Gérez votre abonnement et vos factures Talok",
    href: "/owner/settings/billing",
    icon: CreditCard,
  },
  {
    title: "Personnalisation",
    description: "Personnalisez l'apparence de vos documents",
    href: "/owner/settings/branding",
    icon: Palette,
  },
];

export default function OwnerSettingsPage() {
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground mt-1">
            Gérez votre compte et vos préférences
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {settingsItems.map((item) => (
            <Link key={item.href} href={item.href} className="block">
              <Card className="hover:shadow-md transition-all duration-200 hover:border-blue-200 h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

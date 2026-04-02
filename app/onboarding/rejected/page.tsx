"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail } from "lucide-react";
import Link from "next/link";

export default function OnboardingRejectedPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-2xl">Vérification refusée</CardTitle>
        <CardDescription className="text-base">
          Votre vérification d&apos;identité n&apos;a pas pu être validée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Cela peut arriver si :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Le document est illisible ou expiré</li>
            <li>La photo ne correspond pas au document</li>
            <li>Les informations sont incohérentes</li>
          </ul>
        </div>

        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/onboarding/phone">
              Recommencer la vérification
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <a href="mailto:support@talok.fr">
              <Mail className="mr-2 h-4 w-4" />
              Contacter le support
            </a>
          </Button>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground text-center block"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

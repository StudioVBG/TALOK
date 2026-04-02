"use client";

import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, FileCheck } from "lucide-react";
import Link from "next/link";

export default function OnboardingPendingPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
          <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <CardTitle className="text-2xl">Vérification en cours</CardTitle>
        <CardDescription className="text-base">
          Vos documents sont en cours de vérification par notre équipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
          <FileCheck className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Ce processus prend généralement moins de 24 heures. Vous recevrez
              une notification par email dès que la vérification sera terminée.
            </p>
            {from && (
              <p>
                Vous pourrez ensuite accéder à la page demandée.
              </p>
            )}
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="text-sm text-primary hover:underline text-center block"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

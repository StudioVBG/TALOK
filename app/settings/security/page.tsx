"use client";

import { Suspense } from "react";
import { SecuritySettings } from "@/components/settings/security-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sécurité du compte</h1>
          <p className="text-muted-foreground">
            Gérez la sécurité de votre compte : authentification à deux facteurs, passkeys et codes de récupération.
          </p>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        }
      >
        <SecuritySettings />
      </Suspense>
    </div>
  );
}

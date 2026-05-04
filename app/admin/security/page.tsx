/**
 * Page de sécurité pour les admins.
 *
 * Sert également de gate 2FA : si l'admin n'a pas active la 2FA, le layout
 * /admin redirige vers cette page avec ?force_2fa=1 et bloque l'acces aux
 * autres pages /admin tant que la 2FA n'est pas active.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { SecuritySettings } from "@/components/settings/security-settings";
import { ShieldAlert } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ force_2fa?: string }>;
}

export default async function AdminSecurityPage({ searchParams }: PageProps) {
  const { force_2fa } = await searchParams;
  const forced = force_2fa === "1";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sécurité du compte admin</h1>
        <p className="text-muted-foreground mt-1">
          Les comptes administrateurs doivent activer la 2FA. Cette mesure
          protège la plateforme contre les compromissions de mot de passe.
        </p>
      </div>

      {forced && (
        <div className="flex gap-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
          <ShieldAlert className="h-6 w-6 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">
              2FA obligatoire pour accéder à l'administration
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Activez l'authentification à deux facteurs ci-dessous pour
              débloquer l'accès aux pages d'administration. Tu peux choisir
              une app TOTP (Google Authenticator, 1Password…) ou une passkey
              (Touch ID, Face ID, YubiKey).
            </p>
          </div>
        </div>
      )}

      <SecuritySettings />
    </div>
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { GuarantorSignOutButton } from "./_components/GuarantorSignOutButton";

/**
 * Layout Guarantor - Server Component
 * Vérifie l'authentification et le rôle garant côté serveur.
 * Utilise getServerProfile() pour éviter la récursion RLS.
 */
export default async function GuarantorLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{
    id: string;
    role: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  }>(user.id, "id, role, prenom, nom, avatar_url");

  if (!profile) {
    redirect("/auth/signin");
  }

  // Vérifier que c'est bien un garant
  if (profile.role !== "guarantor") {
    redirect(getRoleDashboardUrl(profile.role));
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <OfflineIndicator />

        {/* Header simplifié */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                {profile.prenom?.[0] || "G"}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {profile.prenom} {profile.nom}
                </p>
                <p className="text-sm text-muted-foreground">Garant</p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/guarantor/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Tableau de bord
              </Link>
              <Link
                href="/guarantor/documents"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Documents
              </Link>
              <Link
                href="/guarantor/profile"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Mon profil
              </Link>
              <GuarantorSignOutButton />
            </nav>
          </div>
        </header>

        {/* Contenu principal */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

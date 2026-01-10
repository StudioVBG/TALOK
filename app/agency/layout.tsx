// =====================================================
// Layout Agency - Server Component SOTA 2026
// Sécurisation serveur avec vérification des permissions
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorBoundary } from "@/components/error-boundary";
import { AgencySidebar } from "./_components/AgencySidebar";

/**
 * Layout Agency - Server Component
 * Vérifie l'authentification et le rôle agency côté serveur
 * SOTA 2026: Protection serveur obligatoire
 */
export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin?redirect=/agency/dashboard");
  }

  // 2. Récupérer le profil avec le rôle
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle agency ou admin
  const allowedRoles = ["agency", "admin", "platform_admin"];
  if (!allowedRoles.includes(profile.role)) {
    // Rediriger vers le bon dashboard selon le rôle
    const roleRedirects: Record<string, string> = {
      owner: "/owner/dashboard",
      tenant: "/tenant/dashboard",
      provider: "/provider/dashboard",
      syndic: "/syndic/dashboard",
    };
    redirect(roleRedirects[profile.role] || "/dashboard");
  }

  // 4. Récupérer les données de l'agence
  const { data: agencyProfile } = await supabase
    .from("agency_profiles")
    .select("*")
    .eq("profile_id", profile.id)
    .single();

  // 5. Rendre le layout
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
        <div className="flex">
          {/* Sidebar Client Component pour interactivité */}
          <AgencySidebar
            profile={profile}
            agencyName={agencyProfile?.nom_agence || "Mon Agence"}
          />

          {/* Main content */}
          <main
            className="md:pl-64 flex-1"
            role="main"
            aria-label="Contenu principal"
          >
            <div className="py-6 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

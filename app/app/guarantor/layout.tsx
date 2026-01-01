export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout Guarantor - Server Component
 * Layout temporaire simplifié pour le rôle garant
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

  // Récupérer le profil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header simplifié */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold">
              {profile.prenom?.[0] || "G"}
            </div>
            <div>
              <p className="font-medium text-slate-900">
                {profile.prenom} {profile.nom}
              </p>
              <p className="text-sm text-slate-500">Garant</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <a 
              href="/app/guarantor/dashboard" 
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Tableau de bord
            </a>
            <a 
              href="/auth/signout" 
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Déconnexion
            </a>
          </nav>
        </div>
      </header>
      
      {/* Contenu principal */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

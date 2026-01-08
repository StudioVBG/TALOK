export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IndexationList } from "./IndexationList";

export const metadata = {
  title: "Révisions de loyer (IRL) | Talok",
  description: "Gérez les révisions annuelles de loyer selon l'IRL",
};

async function fetchIndexations(ownerId: string) {
  const serviceClient = getServiceClient();

  // Récupérer toutes les indexations des baux du propriétaire
  const { data: indexations, error } = await serviceClient
    .from("lease_indexations")
    .select(`
      *,
      lease:lease_id (
        id,
        type_bail,
        loyer,
        date_debut,
        property:property_id (
          id,
          adresse_complete,
          ville,
          code_postal,
          owner_id
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[indexation] Erreur:", error);
    return [];
  }

  // Filtrer par propriétaire
  return (indexations || []).filter(
    (idx: any) => idx.lease?.property?.owner_id === ownerId
  );
}

async function IndexationContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Récupérer le profil propriétaire
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const indexations = await fetchIndexations(profile.id);

  // Grouper par statut
  const pending = indexations.filter((i: any) => i.status === "pending");
  const applied = indexations.filter((i: any) => i.status === "applied");
  const declined = indexations.filter((i: any) => i.status === "declined");

  return (
    <div className="space-y-8">
      {/* Stats rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-900">{pending.length}</p>
              <p className="text-sm text-amber-700">En attente de validation</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{applied.length}</p>
              <p className="text-sm text-green-700">Révisions appliquées</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-slate-500" />
            <div>
              <p className="text-2xl font-bold text-slate-700">{declined.length}</p>
              <p className="text-sm text-slate-600">Non appliquées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des indexations */}
      <IndexationList 
        pending={pending}
        applied={applied}
        declined={declined}
      />
    </div>
  );
}

export default function IndexationPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Link href="/owner/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-blue-600" />
          Révisions de loyer (IRL)
        </h1>
        <p className="text-slate-500 mt-1">
          Gérez les révisions annuelles de loyer selon l'Indice de Référence des Loyers
        </p>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">À propos de l'IRL</p>
            <p className="text-sm text-blue-700 mt-1">
              L'Indice de Référence des Loyers est publié chaque trimestre par l'INSEE.
              Il permet de réviser le loyer à la date anniversaire du bail pour les 
              locations nues et meublées à usage d'habitation principale.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        }
      >
        <IndexationContent />
      </Suspense>
    </div>
  );
}


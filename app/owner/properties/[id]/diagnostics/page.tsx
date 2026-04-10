export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { fetchPropertyDetails } from "../../../_data/fetchPropertyDetails";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DiagnosticsDashboardClient } from "./DiagnosticsDashboardClient";

interface PageProps {
  params: { id: string };
}

export default async function PropertyDiagnosticsPage({ params }: PageProps) {
  const { id } = params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/signin");

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  const details = await fetchPropertyDetails(id, profile.id);
  if (!details) return <div>Non trouvé</div>;

  const property = details.property;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
              <Link href={`/owner/properties/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour au bien
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <h1 className="text-lg font-bold text-slate-900 truncate max-w-[300px]">
              Diagnostics &bull; {property.adresse_complete}
            </h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Dossier de Diagnostic Technique (DDT)</h2>
              <p className="text-slate-500">Gérez et suivez les diagnostics obligatoires pour la mise en location.</p>
            </div>

            <DiagnosticsDashboardClient propertyId={id} />
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-xl border border-blue-100 p-6 shadow-sm">
              <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Conformité Légale
              </h3>
              <p className="text-sm text-blue-700 leading-relaxed mb-4">
                Le DDT est obligatoire pour toute signature de bail. Un DPE manquant ou erroné peut entraîner une réduction du loyer ou l&apos;annulation du bail.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  DPE : Valable 10 ans
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Amiante : Illimité si négatif
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Plomb : 1 an si positif, illimité sinon
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  Gaz / Électricité : Valable 6 ans
                </div>
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  ERP / Termites : Valable 6 mois
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPropertyDetails } from "../../../_data/fetchPropertyDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, ShieldCheck, FileText } from "lucide-react";
import Link from "next/link";
import { DpeStatusCard } from "@/features/diagnostics/components/dpe-status-card";

interface PageProps {
  params: { id: string };
}

export default async function PropertyDiagnosticsPage({ params }: PageProps) {
  const { id } = params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
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
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
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
              Diagnostics • {property.adresse_complete}
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

            <div className="grid grid-cols-1 gap-6">
              <DpeStatusCard propertyId={id} />
              
              {/* Placeholders pour futurs diagnostics */}
              <CardPlaceholder 
                title="Diagnostic Amiante" 
                icon={<ShieldCheck className="h-5 w-5" />} 
                description="Obligatoire pour les biens dont le permis de construire a été délivré avant juillet 1997."
              />
              
              <CardPlaceholder 
                title="État des Risques (ERP)" 
                icon={<Zap className="h-5 w-5" />} 
                description="Obligatoire si le bien est situé dans une zone couverte par un plan de prévention des risques."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-blue-100 p-6 shadow-sm">
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
                  ERP : Valable 6 mois
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardPlaceholder({ title, icon, description }: { title: string, icon: React.ReactNode, description: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 opacity-60 grayscale">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-500">
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-slate-50">Bientôt</Badge>
      </div>
    </div>
  );
}


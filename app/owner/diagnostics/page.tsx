export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Search, 
  Building2, 
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function GlobalDiagnosticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  // Récupérer tous les logements de l'utilisateur
  const { data: properties } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville, type, surface, nb_pieces")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  if (!properties || properties.length === 0) {
    return (
      <div className="container mx-auto py-12 text-center max-w-md">
        <div className="p-4 rounded-full bg-slate-100 text-slate-400 w-fit mx-auto mb-4">
          <Building2 className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Aucun logement trouvé</h1>
        <p className="text-muted-foreground mb-6">Vous devez ajouter un logement avant de pouvoir gérer ses diagnostics.</p>
        <Button asChild>
          <Link href="/owner/properties/new">Ajouter un logement</Link>
        </Button>
      </div>
    );
  }

  // Si un seul logement, on pourrait rediriger, mais c'est mieux de montrer le hub
  // if (properties.length === 1) redirect(`/owner/properties/${properties[0].id}/diagnostics`);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
              <Link href="/owner/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tableau de bord
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <h1 className="text-lg font-bold text-slate-900">Hub Diagnostics</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-10 text-center space-y-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 mb-2">
            CONFORMITÉ LÉGALE (DDT)
          </Badge>
          <h2 className="text-3xl font-bold text-slate-900">Sélectionnez un logement</h2>
          <p className="text-slate-500 w-full max-w-xl mx-auto">
            Pour demander ou mettre à jour vos diagnostics (DPE, Amiante, ERP), choisissez le bien concerné ci-dessous.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {properties.map((property) => (
            <Link key={property.id} href={`/owner/properties/${property.id}/diagnostics`}>
              <Card className="hover:border-blue-300 hover:shadow-md transition-all group overflow-hidden border-slate-200">
                <CardContent className="p-0">
                  <div className="flex items-center">
                    <div className="p-6 bg-slate-50 group-hover:bg-blue-50 border-r border-slate-100 transition-colors">
                      <Building2 className="h-8 w-8 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <div className="p-6 flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{property.adresse_complete}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-slate-500">{property.ville}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-sm text-slate-500 capitalize">{property.type} • {property.nb_pieces} p. • {property.surface}m²</span>
                      </div>
                    </div>
                    <div className="pr-6">
                      <div className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all">
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-4">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-amber-900">Pourquoi tenir mon DDT à jour ?</h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              Le dossier de diagnostic technique (DDT) protège le propriétaire contre les recours pour vices cachés. Il doit être fourni dès la mise en location et annexé au bail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


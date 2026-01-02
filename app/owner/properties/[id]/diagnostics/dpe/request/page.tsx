export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPropertyDetails } from "../../../../../_data/fetchPropertyDetails";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { DpeRequestForm } from "@/features/diagnostics/components/dpe-request-form";

interface PageProps {
  params: { id: string };
}

export default async function DpeRequestPage({ params }: PageProps) {
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
              <Link href={`/owner/properties/${id}/diagnostics`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <h1 className="text-lg font-bold text-slate-900">Demander un DPE</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 p-4 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200/50 flex items-center justify-between overflow-hidden relative">
          <div className="relative z-10">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Formulaire Express
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              Nous avons pré-rempli les informations de votre logement pour gagner du temps.
            </p>
          </div>
          <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
            <Sparkles className="h-32 w-32" />
          </div>
        </div>

        <DpeRequestForm property={{
          id: property.id,
          adresse_complete: property.adresse_complete,
          type: property.type,
          surface: (property as any).surface
        }} />
      </div>
    </div>
  );
}


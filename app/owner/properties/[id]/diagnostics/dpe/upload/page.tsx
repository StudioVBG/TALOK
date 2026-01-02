export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchPropertyDetails } from "../../../../../_data/fetchPropertyDetails";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileUp } from "lucide-react";
import Link from "next/link";
import { DpeUploadForm } from "@/features/diagnostics/components/dpe-upload-form";

interface PageProps {
  params: { id: string };
}

export default async function DpeUploadPage({ params }: PageProps) {
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
            <h1 className="text-lg font-bold text-slate-900">Importer un DPE</h1>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 p-6 rounded-xl bg-slate-900 text-white shadow-xl flex items-start gap-4">
          <div className="p-3 rounded-lg bg-slate-800">
            <FileUp className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Import du rapport officiel</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Veuillez déposer le rapport PDF définitif. Le numéro ADEME à 13 chiffres ainsi que les classes énergie et GES seront vérifiés pour garantir la conformité du dossier de location.
            </p>
          </div>
        </div>

        <DpeUploadForm propertyId={id} />
      </div>
    </div>
  );
}


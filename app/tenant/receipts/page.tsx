export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReceiptsTable } from "@/features/tenant/components/receipts-table";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchTenantLease } from "../_data/fetchTenantLease";

export const metadata = {
  title: "Mes Quittances | Talok",
  description: "Consultez et téléchargez vos quittances de loyer",
};

async function ReceiptsContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Récupérer le bail du locataire
  const lease = await fetchTenantLease(user.id);

  if (!lease) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">
          Aucun bail actif
        </h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Vous n'avez pas encore de bail actif. Les quittances apparaîtront ici 
          une fois que votre bail sera signé et que des paiements seront effectués.
        </p>
        <Link href="/tenant/dashboard">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au tableau de bord
          </Button>
        </Link>
      </div>
    );
  }

  return <ReceiptsTable leaseId={lease.id} />;
}

export default function TenantReceiptsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/tenant/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            Mes Quittances
          </h1>
          <p className="text-slate-500 mt-1">
            Historique de vos paiements et quittances de loyer
          </p>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">À propos des quittances</p>
            <p className="text-sm text-blue-700 mt-1">
              Une quittance est générée automatiquement après chaque paiement de loyer. 
              Elle constitue une preuve de paiement que vous pouvez conserver ou fournir 
              lors de démarches administratives (CAF, dossier location, etc.).
            </p>
          </div>
        </div>
      </div>

      {/* Table des quittances */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        }
      >
        <ReceiptsContent />
      </Suspense>
    </div>
  );
}


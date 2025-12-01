// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { fetchTenantLease } from "../_data/fetchTenantLease";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { FileText, Home, User } from "lucide-react";

export default async function TenantLeasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const lease = await fetchTenantLease(user.id);

  if (!lease) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Aucun bail actif</h1>
        <p className="text-muted-foreground">Vous n'avez pas encore de bail associé à votre compte.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Mon bail</h1>
        <p className="text-muted-foreground">Détails de votre contrat de location</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Infos Bail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contrat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{lease.type_bail}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Début</span>
              <span className="font-medium">{formatDateShort(lease.date_debut)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Fin</span>
              <span className="font-medium">{lease.date_fin ? formatDateShort(lease.date_fin) : "Indéterminée"}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-muted-foreground">Statut</span>
              <Badge variant="outline">{lease.statut}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Infos Financières */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Loyer & Charges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Loyer hors charges</span>
              <span className="font-medium">{formatCurrency(lease.loyer)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Charges (provisions)</span>
              <span className="font-medium">{formatCurrency(lease.charges_forfaitaires)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="font-semibold">Total mensuel</span>
              <span className="font-bold text-lg text-blue-600">
                {formatCurrency((lease.loyer || 0) + (lease.charges_forfaitaires || 0))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Infos Logement */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Logement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium text-lg">{lease.property?.adresse_complete}</p>
            <p className="text-muted-foreground">
              {lease.property?.code_postal} {lease.property?.ville}
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <Badge variant="secondary">{lease.property?.type}</Badge>
              {lease.property?.surface && <span>{lease.property.surface} m²</span>}
              {lease.property?.nb_pieces && <span>{lease.property.nb_pieces} pièces</span>}
            </div>
          </CardContent>
        </Card>

        {/* Propriétaire */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Propriétaire / Gestionnaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xl">
                {lease.property?.owner?.prenom?.[0]}{lease.property?.owner?.nom?.[0]}
              </div>
              <div>
                <p className="font-medium text-lg">
                  {lease.property?.owner?.prenom} {lease.property?.owner?.nom}
                </p>
                <p className="text-muted-foreground text-sm">{lease.property?.owner?.email}</p>
                <p className="text-muted-foreground text-sm">{lease.property?.owner?.telephone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

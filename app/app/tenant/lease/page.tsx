// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { fetchTenantLease } from "../_data/fetchTenantLease";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { FileText, Home, User, Download, CheckCircle, Clock, FileSignature } from "lucide-react";
import Link from "next/link";

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
        <p className="text-sm text-muted-foreground mt-2">
          Si vous avez signé un bail récemment, veuillez patienter ou contacter votre propriétaire.
        </p>
      </div>
    );
  }

  // Récupérer les infos de signature
  const tenantSigner = lease.lease_signers?.find((s: any) => s.role === "locataire_principal");
  const ownerSigner = lease.lease_signers?.find((s: any) => s.role === "proprietaire");
  const isTenantSigned = tenantSigner?.signature_status === "signed";
  const isOwnerSigned = ownerSigner?.signature_status === "signed";
  const isFullySigned = isTenantSigned && isOwnerSigned;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Mon bail</h1>
          <p className="text-muted-foreground">Détails de votre contrat de location</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/api/leases/${lease.id}/pdf`}>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Aperçu PDF
            </Button>
          </Link>
          {isTenantSigned && (
            <Link href={`/api/leases/${lease.id}/pdf-signed`}>
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <FileSignature className="h-4 w-4" />
                PDF Signé
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Statut de signature */}
      <Card className="mb-6 border-l-4 border-l-blue-500">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-semibold">Statut des signatures</h3>
                <p className="text-sm text-muted-foreground">
                  {isFullySigned ? "Bail entièrement signé" : "Signatures en cours"}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isTenantSigned ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {isTenantSigned ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {isTenantSigned ? "Signé" : "En attente"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Locataire</p>
              </div>
              <div className="text-center">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isOwnerSigned ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {isOwnerSigned ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {isOwnerSigned ? "Signé" : "En attente"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Propriétaire</p>
              </div>
            </div>
          </div>
          {tenantSigner?.signed_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Vous avez signé le {new Date(tenantSigner.signed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </CardContent>
      </Card>

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
              <Badge variant={lease.statut === "active" ? "default" : "outline"}>{lease.statut}</Badge>
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

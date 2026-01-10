"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { leasesService } from "@/features/leases/services/leases.service";
import { LeaseSigners } from "@/features/leases/components/lease-signers";
import { InvoicesList } from "@/features/billing/components/invoices-list";
import { GenerateInvoiceForm } from "@/features/billing/components/generate-invoice-form";
import { DocumentsList } from "@/features/documents/components/documents-list";
import type { Lease, LeaseType, LeaseStatus } from "@/lib/types";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/use-auth";

// Labels pour les types de bail
const LEASE_TYPE_LABELS: Record<LeaseType, string> = {
  nu: "Bail nu",
  meuble: "Bail meublé",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  bail_mobilite: "Bail mobilité",
  commercial_3_6_9: "Commercial 3/6/9",
  commercial_derogatoire: "Commercial dérogatoire",
  professionnel: "Professionnel",
  contrat_parking: "Contrat parking",
  location_gerance: "Location gérance",
};

// Labels pour les statuts de bail
const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  pending_signature: "En attente de signature",
  partially_signed: "Partiellement signé",
  pending_owner_signature: "Attente signature propriétaire",
  fully_signed: "Entièrement signé",
  active: "Actif",
  notice_given: "Préavis en cours",
  amended: "Avenant en cours",
  terminated: "Terminé",
  archived: "Archivé",
};

function LeaseDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchLease = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const data = await leasesService.getLeaseById(id);
      setLease(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Impossible de charger le bail.";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
      router.push("/owner/leases");
    } finally {
      setLoading(false);
    }
  }, [toast, router]);

  useEffect(() => {
    const id = params.id;
    if (typeof id === "string") {
      fetchLease(id);
    }
  }, [params.id, fetchLease]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!lease) {
    return null;
  }

  const getTypeLabel = (type: LeaseType): string => {
    return LEASE_TYPE_LABELS[type] || type;
  };

  const getStatusLabel = (status: LeaseStatus): string => {
    return LEASE_STATUS_LABELS[status] || status;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{getTypeLabel(lease.type_bail)}</h1>
          <p className="text-muted-foreground">
            Du {formatDateShort(lease.date_debut)}
            {lease.date_fin && ` au ${formatDateShort(lease.date_fin)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/leases/${lease.id}/edit`}>
            <Button variant="outline">Modifier</Button>
          </Link>
          <Link href="/owner/leases">
            <Button variant="ghost">Retour</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations financières</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Loyer mensuel</p>
              <p className="font-medium text-lg">{formatCurrency(lease.loyer)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Charges forfaitaires</p>
              <p className="font-medium text-lg">{formatCurrency(lease.charges_forfaitaires)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total mensuel</p>
              <p className="font-medium text-xl">
                {formatCurrency(lease.loyer + lease.charges_forfaitaires)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dépôt de garantie</p>
              <p className="font-medium text-lg">{formatCurrency(lease.depot_de_garantie)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Type de bail</p>
              <p className="font-medium">{getTypeLabel(lease.type_bail)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <p className="font-medium">{getStatusLabel(lease.statut)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date de début</p>
              <p className="font-medium">{formatDateShort(lease.date_debut)}</p>
            </div>
            {lease.date_fin && (
              <div>
                <p className="text-sm text-muted-foreground">Date de fin</p>
                <p className="font-medium">{formatDateShort(lease.date_fin)}</p>
              </div>
            )}
            {lease.property_id && (
              <div>
                <p className="text-sm text-muted-foreground">Logement</p>
                <Link
                  href={`/properties/${lease.property_id}`}
                  className="font-medium text-primary hover:underline"
                >
                  Voir le logement →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LeaseSigners leaseId={lease.id} onUpdate={() => {
        const id = params.id;
        if (typeof id === "string") fetchLease(id);
      }} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Factures</h2>
        </div>
        {(profile?.role === "owner" || profile?.role === "admin") && lease.statut === "active" && (
          <GenerateInvoiceForm
            leaseId={lease.id}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        )}
        <InvoicesList key={refreshKey} leaseId={lease.id} />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Documents</h2>
        <DocumentsList leaseId={lease.id} />
      </div>
    </div>
  );
}

export default function LeaseDetailPage() {
  return (
    <ProtectedRoute>
      <LeaseDetailPageContent />
    </ProtectedRoute>
  );
}


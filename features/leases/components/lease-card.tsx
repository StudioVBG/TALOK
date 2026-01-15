"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { leasesService } from "../services/leases.service";
import type { Lease } from "@/lib/types";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";

interface LeaseCardProps {
  lease: Lease;
  onDelete?: () => void;
}

export function LeaseCard({ lease, onDelete }: LeaseCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce bail ?")) return;

    setDeleting(true);
    try {
      await leasesService.deleteLease(lease.id);
      toast({
        title: "Bail supprimé",
        description: "Le bail a été supprimé avec succès.",
      });
      onDelete?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      nu: "Bail nu",
      meuble: "Bail meublé",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Brouillon",
      sent: "Envoyé",
      pending_signature: "En attente de signature",
      partially_signed: "Partiellement signé",
      pending_owner_signature: "Attente signature propriétaire",
      fully_signed: "✅ Signé - En attente EDL",
      active: "Actif",
      amended: "Avenant",
      terminated: "Terminé",
      archived: "Archivé",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      pending_signature: "bg-yellow-100 text-yellow-800",
      partially_signed: "bg-orange-100 text-orange-800",
      pending_owner_signature: "bg-orange-100 text-orange-800",
      fully_signed: "bg-indigo-100 text-indigo-800",
      active: "bg-green-100 text-green-800",
      amended: "bg-purple-100 text-purple-800",
      terminated: "bg-red-100 text-red-800",
      archived: "bg-gray-200 text-gray-600",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{getTypeLabel(lease.type_bail)}</CardTitle>
            <CardDescription>
              Du {formatDateShort(lease.date_debut)}
              {lease.date_fin && ` au ${formatDateShort(lease.date_fin)}`}
            </CardDescription>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(lease.statut)}`}>
            {getStatusLabel(lease.statut)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loyer :</span>
            <span className="font-medium">{formatCurrency(lease.loyer)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Charges :</span>
            <span className="font-medium">{formatCurrency(lease.charges_forfaitaires)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total mensuel :</span>
            <span className="font-medium">
              {formatCurrency(lease.loyer + lease.charges_forfaitaires)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dépôt de garantie :</span>
            <span className="font-medium">{formatCurrency(lease.depot_de_garantie)}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Link href={`/leases/${lease.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Voir détails
            </Button>
          </Link>
          <Link href={`/leases/${lease.id}/edit`} className="flex-1">
            <Button variant="outline" className="w-full">
              Modifier
            </Button>
          </Link>
          <Button variant="destructive" size="icon" onClick={handleDelete} disabled={deleting} aria-label="Supprimer le bail">
            {deleting ? "..." : "🗑️"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


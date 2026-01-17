"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useDeleteProperty, useUpdateProperty } from "@/lib/hooks";
import { ResourceNotFoundError } from "@/lib/api-client";
import type { Property } from "@/lib/types";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Shield, Sparkles, AlertTriangle } from "lucide-react";

interface PropertyCardProps {
  property: Property;
  onRefresh?: () => void;
  onRemove?: (id: string) => void;
}

const STATUS_VARIANTS: Record<Property["etat"], { label: string; variant: BadgeProps["variant"] }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  pending: { label: "En attente", variant: "warning" },
  published: { label: "Publié", variant: "success" },
  rejected: { label: "Rejeté", variant: "destructive" },
  archived: { label: "Archivé", variant: "outline" },
};

export function PropertyCard({ property, onRefresh, onRemove }: PropertyCardProps) {
  const { toast } = useToast();
  const deleteProperty = useDeleteProperty();
  const updateProperty = useUpdateProperty();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removed, setRemoved] = useState(false);

  if (removed) {
    return (
      <Card className="border border-dashed border-muted bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Logement supprimé. Actualisation en cours...
      </Card>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteProperty.mutateAsync(property.id);
      toast({
        title: "Logement supprimé",
        description: "Le logement a été supprimé avec succès.",
      });
      setRemoved(true);
      onRemove?.(property.id);
      onRefresh?.();
    } catch (error: unknown) {
      const notFound =
        error instanceof ResourceNotFoundError ||
        error?.message?.includes("Ressource introuvable") ||
        error?.message?.includes("Propriété non trouvée");

      toast({
        title: notFound ? "Déjà supprimé" : "Erreur",
        description: notFound
          ? "Ce logement n'existe plus ou a déjà été supprimé. Liste mise à jour."
          : error instanceof Error ? error.message : "Une erreur est survenue lors de la suppression.",
        variant: notFound ? "default" : "destructive",
      });

      if (notFound) {
        setRemoved(true);
        onRemove?.(property.id);
        onRefresh?.();
      }
    } finally {
      setConfirmOpen(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Mettre à jour le statut avec optimistic update
      await updateProperty.mutateAsync({
        id: property.id,
        data: { etat: "pending_review" } as any, // PropertyUpdate peut ne pas inclure 'etat' dans les types générés
      });
      toast({
        title: "Logement soumis",
        description: "Votre logement est maintenant en attente de validation.",
      });
      onRefresh?.();
    } catch (error: unknown) {
      toast({
        title: "Impossible de soumettre",
        description:
          error?.message ||
          "Une erreur est survenue lors de la soumission. Vérifiez les champs requis.",
        variant: "destructive",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      appartement: "Appartement",
      maison: "Maison",
      colocation: "Colocation",
      saisonnier: "Saisonnier",
      local_commercial: "Local commercial",
      bureaux: "Bureaux",
      entrepot: "Entrepôt",
      parking: "Parking",
      fonds_de_commerce: "Fonds de commerce",
    };
    return labels[type] || type;
  };

  const getUsageLabel = (usage: string) => {
    const usageLabels: Record<string, string> = {
      habitation: "Usage habitation",
      local_commercial: "Usage commercial",
      bureaux: "Usage bureaux",
      entrepot: "Usage entrepôt",
      parking: "Usage parking",
      fonds_de_commerce: "Fonds de commerce",
    };
    return usageLabels[usage] || usage;
  };

  const currentStatus: Property["etat"] =
    property.etat ?? ("draft" as Property["etat"]);
  const status = STATUS_VARIANTS[currentStatus] ?? STATUS_VARIANTS.draft;
  const canSubmit = ["draft", "rejected"].includes(currentStatus);
  const cannotEdit = !["draft", "rejected"].includes(currentStatus);
  const renderDeleteAction = () => (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="icon"
          disabled={deleteProperty.isPending || cannotEdit}
          title={
            cannotEdit
              ? "Suppression bloquée pendant la validation"
              : "Supprimer définitivement"
          }
          aria-label={
            cannotEdit
              ? "Suppression bloquée pendant la validation"
              : "Supprimer le logement"
          }
          className="relative overflow-hidden border border-destructive/30 bg-gradient-to-br from-destructive via-destructive to-red-600 shadow-lg transition hover:scale-[1.02] hover:shadow-destructive/40 disabled:opacity-60"
        >
          <span className="absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-50" />
          {cannotEdit ? (
            <Shield className="h-4 w-4" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-6">
        <DialogHeader className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Action irréversible
          </div>
          <DialogTitle>Supprimer ce logement ?</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {property.adresse_complete}. Cette action supprimera toutes les informations et médias
            associés. Une fois supprimé, le logement ne pourra plus être récupéré.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-red-100 bg-red-50/60 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-100">
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4 text-red-500" />
            Astuce productivité
          </p>
          <p className="mt-2 text-red-900/80 dark:text-red-200">
            Pense plutôt à archiver si tu souhaites garder un historique. La suppression est
            définitive.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProperty.isPending}
            className="flex-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white shadow-md hover:shadow-lg"
          >
            {deleteProperty.isPending ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const totalLoyer = (property.loyer_base ?? 0) + (property.charges_mensuelles ?? 0);
  const isZoneEncadree = property.zone_encadrement ?? false;

  return (
    <Card>
      <CardHeader>
        {property.cover_url && (
          <div className="-mt-4 mb-3 overflow-hidden rounded-md border">
            <div className="relative h-40 w-full">
              <Image
                src={property.cover_url}
                alt={`Aperçu du bien ${property.adresse_complete}`}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover"
              />
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{getTypeLabel(property.type)}</CardTitle>
            <CardDescription>{property.adresse_complete}</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge
              variant={property.usage_principal === "habitation" ? "secondary" : "warning"}
            >
              {getUsageLabel(property.usage_principal)}
            </Badge>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {property.unique_code}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {property.sous_usage && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-usage :</span>
              <span className="font-medium capitalize">{property.sous_usage.replace(/_/g, " ")}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ville :</span>
            <span className="font-medium">
              {property.code_postal} {property.ville}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Surface :</span>
            <span className="font-medium">{property.surface} m²</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pièces :</span>
            <span className="font-medium">{property.nb_pieces}</span>
          </div>
          {property.etage !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Étage :</span>
              <span className="font-medium">{property.etage}</span>
            </div>
          )}
          {property.energie && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Classe énergétique :</span>
              <span className="font-medium">{property.energie}</span>
            </div>
          )}
          {property.erp_type && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">ERP :</span>
              <span className="font-medium">
                {property.erp_type}
                {property.erp_categorie ? ` • ${property.erp_categorie}` : ""}
              </span>
            </div>
          )}
          {property.documents_count !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Médias :</span>
              <span className="font-medium">{property.documents_count}</span>
            </div>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loyer HC :</span>
            <span className="font-medium">{formatCurrency(property.loyer_base ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Charges :</span>
            <span className="font-medium">{formatCurrency(property.charges_mensuelles ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total CC :</span>
            <span className="font-semibold text-primary">{formatCurrency(totalLoyer)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dépôt :</span>
            <span className="font-medium">{formatCurrency(property.depot_garantie ?? 0)}</span>
          </div>
          {isZoneEncadree && (
            <div className="mt-2 rounded-md border border-muted bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
              Encadrement : réf. {formatCurrency(property.loyer_reference_majoré ?? 0)}
              {property.complement_loyer !== null && (
                <>
                  {" "}+ compl. {formatCurrency(property.complement_loyer ?? 0)}
                </>
              )}
            </div>
          )}
          {property.places_parking > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Places / boxes :</span>
              <span className="font-medium">{property.places_parking}</span>
            </div>
          )}
          {(property.has_irve || (property.parking_badge_count ?? 0) > 0) && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Accès / IRVE :</span>
              <span className="font-medium">
                {property.has_irve ? "IRVE" : "—"}
                {(property.parking_badge_count ?? 0) > 0 ? ` • ${property.parking_badge_count} badge(s)` : ""}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ajouté le :</span>
            <span className="font-medium">{formatDateShort(property.created_at)}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Link href={`/owner/properties/${property.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              Voir / Modifier
            </Button>
          </Link>
          {canSubmit && (
            <Button
              variant="default"
              size="icon"
              onClick={handleSubmit}
              disabled={updateProperty.isPending}
              title="Soumettre à validation"
              aria-label="Soumettre à validation"
            >
              {updateProperty.isPending ? "…" : "↗"}
            </Button>
          )}
          {renderDeleteAction()}
        </div>
      </CardContent>
    </Card>
  );
}


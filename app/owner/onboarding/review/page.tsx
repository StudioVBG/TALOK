"use client";
// @ts-nocheck

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Loader2, Home, ArrowRight, FileText } from "lucide-react";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { propertiesService } from "@/features/properties/services/properties.service";
import { documentsService } from "@/features/documents/services/documents.service";
import { DocumentGalleryManager } from "@/features/documents/components/document-gallery-manager";
import type { Document, Property } from "@/lib/types";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

interface ChecklistItem {
  key: string;
  label: string;
  detail?: string;
  valid: boolean;
}

export default function OwnerReviewPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const draft = await onboardingService.getDraft();
      let propertyId: string | null = null;

      if (draft?.step === "final_review" && draft.data?.property_id) {
        propertyId = draft.data.property_id as string;
      }

      if (!propertyId) {
        // fallback: prendre le logement le plus récent du propriétaire
        const properties = await propertiesService.getProperties();
        propertyId = properties[0]?.id ?? null;
      }

      if (!propertyId) {
        toast({
          title: "Aucun logement",
          description: "Ajoutez d'abord un logement avant de finaliser l'onboarding.",
          variant: "destructive",
        });
        router.push("/owner/onboarding/property");
        return;
      }

      const fetchedProperty = await propertiesService.getPropertyById(propertyId);
      setProperty(fetchedProperty);

      const docs = await documentsService.getDocumentsByProperty(propertyId, "property_media");
      setDocuments(docs);
    } catch (error: unknown) {
      console.error(error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger la revue finale.",
        variant: "destructive",
      });
      router.push("/owner/dashboard");
    } finally {
      setLoading(false);
    }
  }

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!property) return [];

    const totalCc = (property.loyer_base ?? 0) + (property.charges_mensuelles ?? 0);
    const hasMedia = documents.length > 0;
    const hasCover = documents.some((doc) => doc.is_cover);
    const encadrementPlafond =
      property.loyer_reference_majoré !== null
        ? property.loyer_reference_majoré + (property.complement_loyer ?? 0)
        : null;

    return [
      {
        key: "coordinates",
        label: "Coordonnées et caractéristiques complètes",
        detail: `${property.adresse_complete} • ${property.surface} m² • ${property.nb_pieces} pièce(s)`,
        valid:
          Boolean(property.adresse_complete) &&
          Boolean(property.code_postal) &&
          Boolean(property.ville) &&
          property.surface > 0 &&
          property.nb_pieces > 0,
      },
      {
        key: "financial",
        label: "Loyer, charges et dépôt de garantie renseignés",
        detail: `${formatCurrency(property.loyer_base)} HC • ${formatCurrency(
          property.charges_mensuelles
        )} charges • ${formatCurrency(totalCc)} CC`,
        valid:
          property.loyer_base !== null &&
          property.loyer_base > 0 &&
          property.charges_mensuelles !== null &&
          property.charges_mensuelles >= 0 &&
          property.depot_garantie !== null &&
          property.depot_garantie >= 0,
      },
      {
        key: "encadrement",
        label: "Encadrement des loyers conforme",
        detail: property.zone_encadrement
          ? encadrementPlafond
            ? `Plafond ${formatCurrency(encadrementPlafond)}`
            : "Compléter le loyer de référence majoré"
          : "Zone non soumise",
        valid:
          !property.zone_encadrement ||
          (property.loyer_reference_majoré !== null &&
            property.loyer_base !== null &&
            encadrementPlafond !== null &&
            property.loyer_base <= encadrementPlafond + 0.5),
      },
      {
        key: "dpe",
        label: "Diagnostics énergétiques renseignés",
        detail: property.dpe_classe_energie
          ? `Classe ${property.dpe_classe_energie} • ${property.dpe_consommation ?? "?"} kWh • ${
              property.dpe_emissions ?? "?"
            } kgCO₂`
          : "Compléter les informations DPE",
        valid:
          Boolean(property.dpe_classe_energie) &&
          Boolean(property.dpe_classe_climat) &&
          property.dpe_consommation !== null &&
          property.dpe_emissions !== null,
      },
      {
        key: "permis",
        label: "Permis de louer renseigné (si requis)",
        detail: property.permis_louer_requis
          ? property.permis_louer_numero || "Compléter le numéro du permis de louer"
          : "Non requis pour ce logement",
        valid: !property.permis_louer_requis || Boolean(property.permis_louer_numero),
      },
      {
        key: "media",
        label: "Galerie de médias avec visuel principal",
        detail: hasMedia
          ? `${documents.length} fichier(s) • ${
              hasCover ? "Visuel principal défini" : "Définir un visuel principal"
            }`
          : "Ajoutez au moins une photo ou un document clé",
        valid: hasMedia && hasCover,
      },
      {
        key: "status",
        label: "Logement prêt à être soumis",
        detail: `Statut actuel : ${property.etat}`,
        valid: ["draft", "rejected"].includes(property.etat),
      },
    ];
  }, [documents, property]);

  const readyToSubmit = checklist.length > 0 && checklist.every((item) => item.valid);

  const handleSubmit = async () => {
    if (!property) return;
    setSubmitting(true);
    try {
      await propertiesService.submitProperty(property.id);
      await onboardingService.markStepCompleted("final_review", "owner");
      await onboardingService.clearDraft();
      toast({
        title: "Logement soumis",
        description: "Votre logement est désormais en attente de validation.",
      });
      router.push("/owner/dashboard");
    } catch (error: unknown) {
      toast({
        title: "Soumission impossible",
        description: error instanceof Error ? error.message : "Vérifiez que toutes les informations sont complètes.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          Chargement de la revue finale...
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Impossible de charger le logement</CardTitle>
            <CardDescription>
              Ajoutez d'abord un logement avant de poursuivre la revue finale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/owner/onboarding/property")}>
              <Home className="mr-2 h-4 w-4" />
              Ajouter un logement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Revue finale</h1>
          <p className="text-muted-foreground">
            Vérifiez les informations de votre logement avant soumission.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{property.type}</Badge>
          <Badge>{property.ville}</Badge>
          <Badge variant="outline">{property.surface} m²</Badge>
          <Badge variant="outline">{property.nb_pieces} pièce(s)</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Résumé du logement</CardTitle>
            <CardDescription>{property.adresse_complete}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Usage :</span>{" "}
              <strong>{property.usage_principal}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Loyer HC :</span>{" "}
              <strong>{formatCurrency(property.loyer_base)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Charges :</span>{" "}
              <strong>{formatCurrency(property.charges_mensuelles)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Total CC :</span>{" "}
              <strong>
                {formatCurrency(
                  (property.loyer_base ?? 0) + (property.charges_mensuelles ?? 0)
                )}
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground">Dépôt de garantie :</span>{" "}
              <strong>{formatCurrency(property.depot_garantie)}</strong>
            </p>
            <div className="pt-2">
              <Link href={`/owner/properties/${property.id}`} className="text-primary hover:underline">
                Ouvrir la fiche complète du logement
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Checklist avant soumission</CardTitle>
            <CardDescription>
              Tous les éléments indispensables doivent être en vert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div
                key={item.key}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="mt-0.5">
                  {item.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium leading-tight">{item.label}</p>
                  {item.detail && (
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Médias & documents</CardTitle>
          <CardDescription>
            Ajoutez plusieurs photos, diagnostics ou justificatifs et organisez-les.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DocumentGalleryManager
            propertyId={property.id}
            collection="property_media"
            type="autre"
            onChange={setDocuments}
          />
          {!documents.length && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              Ajoutez au moins une photo du bien avant la soumission.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          {readyToSubmit
            ? "Tout est prêt ! Vous pouvez soumettre le logement aux équipes de validation."
            : "Complétez les éléments en attente pour activer le bouton de soumission."}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/owner/onboarding/property")}>
            <Home className="mr-2 h-4 w-4" />
            Retour au formulaire
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!readyToSubmit || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Soumission...
              </>
            ) : (
              <>
                Soumettre le logement
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}






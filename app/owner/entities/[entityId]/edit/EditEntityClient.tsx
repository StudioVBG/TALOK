"use client";

/**
 * EditEntityClient — Client component for editing an entity
 *
 * Receives pre-loaded entity data from the Server Component wrapper.
 * Uses the shared EntityFormWizard for the stepper UI.
 */

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useEntityStore } from "@/stores/useEntityStore";
import { updateEntity } from "@/app/owner/entities/actions";
import { EntityFormWizard } from "@/components/entities/create/EntityFormWizard";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

interface EditEntityClientProps {
  entityId: string;
  initialData: EntityFormData;
  entityName: string;
}

export function EditEntityClient({
  entityId,
  initialData,
  entityName,
}: EditEntityClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { updateEntity: updateStoreEntity } = useEntityStore();

  const handleSubmit = async (formData: EntityFormData) => {
    try {
      const entityPayload = {
        id: entityId,
        entity_type: formData.entityType || "sci_ir",
        nom: formData.nom,
        forme_juridique: formData.formeJuridique || undefined,
        regime_fiscal: formData.regimeFiscal || "ir",
        siret: formData.siret.replace(/\s/g, "") || undefined,
        capital_social: formData.capitalSocial
          ? parseFloat(formData.capitalSocial)
          : undefined,
        nombre_parts: formData.nombreParts
          ? parseInt(formData.nombreParts, 10)
          : undefined,
        rcs_ville: formData.rcsVille || undefined,
        date_creation: formData.dateCreation || undefined,
        numero_tva: formData.numeroTva || undefined,
        adresse_siege: formData.adresseSiege || undefined,
        code_postal_siege: formData.codePostalSiege || undefined,
        ville_siege: formData.villeSiege || undefined,
        iban: formData.iban.replace(/\s/g, "") || undefined,
        bic: formData.bic || undefined,
        banque_nom: formData.banqueNom || undefined,
        email_entite: formData.emailEntite || undefined,
        telephone_entite: formData.telephoneEntite || undefined,
      };

      const result = await updateEntity(entityPayload as any);

      if (!result.success) {
        throw new Error(result.error || "Erreur lors de la mise à jour");
      }

      // Update store
      updateStoreEntity(entityId, {
        nom: entityPayload.nom,
        entityType: entityPayload.entity_type,
        legalForm: entityPayload.forme_juridique,
        fiscalRegime: entityPayload.regime_fiscal,
        siret: entityPayload.siret,
        codePostalSiege: entityPayload.code_postal_siege,
        villeSiege: entityPayload.ville_siege,
        hasIban: !!entityPayload.iban,
      });

      toast({
        title: "Entité modifiée",
        description: `${entityPayload.nom} a été mise à jour.`,
      });

      router.push(`/owner/entities/${entityId}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de modifier l'entité.",
        variant: "destructive",
      });
    }
  };

  return (
    <EntityFormWizard
      mode="edit"
      entityId={entityId}
      initialData={initialData}
      onSubmit={handleSubmit}
      backHref={`/owner/entities/${entityId}`}
      header={{
        title: "Modifier l\u2019entité",
        subtitle: entityName || "Entité juridique",
        backLabel: "Retour à la fiche",
      }}
      submitLabel="Enregistrer les modifications"
      submitLoadingLabel="Enregistrement..."
    />
  );
}

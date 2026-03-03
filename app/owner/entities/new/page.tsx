"use client";

/**
 * Page /owner/entities/new — Création d'une nouvelle entité juridique
 *
 * Utilise le wizard partagé EntityFormWizard.
 * Gère la soumission via la Server Action createEntity.
 */

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useEntityStore } from "@/stores/useEntityStore";
import { createEntity } from "@/app/owner/entities/actions";
import { EntityFormWizard } from "@/components/entities/create/EntityFormWizard";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

export default function NewEntityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { addEntity } = useEntityStore();

  const handleSubmit = async (formData: EntityFormData) => {
    try {
      const result = await createEntity({
        entity_type: formData.entityType as Parameters<
          typeof createEntity
        >[0]["entity_type"],
        nom: formData.nom || "Patrimoine personnel",
        forme_juridique: formData.formeJuridique || undefined,
        regime_fiscal:
          (formData.regimeFiscal as
            | "ir"
            | "is"
            | "ir_option_is"
            | "is_option_ir") || undefined,
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
        pays_siege: "France",
        iban: formData.iban.replace(/\s/g, "") || undefined,
        bic: formData.bic || undefined,
        banque_nom: formData.banqueNom || undefined,
        representant_mode: formData.representantMode,
        representant_prenom: formData.representantPrenom || undefined,
        representant_nom: formData.representantNom || undefined,
        representant_qualite: formData.representantQualite || undefined,
        representant_date_naissance:
          formData.representantDateNaissance || undefined,
        email_entite: formData.emailEntite || undefined,
        telephone_entite: formData.telephoneEntite || undefined,
      });

      if (!result.success) {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      const entityId = result.data?.id;

      // Update client store
      addEntity({
        id: entityId!,
        nom: formData.nom || "Patrimoine personnel",
        entityType: formData.entityType,
        legalForm: formData.formeJuridique || null,
        fiscalRegime: formData.regimeFiscal || null,
        siret: formData.siret.replace(/\s/g, "") || null,
        codePostalSiege: formData.codePostalSiege || null,
        villeSiege: formData.villeSiege || null,
        isDefault: false,
        isActive: true,
        couleur: null,
        propertyCount: 0,
        activeLeaseCount: 0,
        hasIban: !!formData.iban,
      });

      toast({
        title: "Entité créée",
        description: `${formData.nom || "Patrimoine personnel"} a été créée avec succès.`,
      });

      router.push(`/owner/entities/${entityId}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'entité.",
        variant: "destructive",
      });
    }
  };

  return (
    <EntityFormWizard
      mode="create"
      onSubmit={handleSubmit}
      backHref="/owner/entities"
      header={{
        title: "Nouvelle entité",
        subtitle:
          "Configurez votre structure juridique en quelques étapes",
        backLabel: "Mes entités",
      }}
      submitLabel="Créer l&apos;entité"
      submitLoadingLabel="Création..."
    />
  );
}

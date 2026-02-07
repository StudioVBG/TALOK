"use client";

/**
 * EntityEditForm — Formulaire de modification d'une entité juridique
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useEntityStore } from "@/stores/useEntityStore";
import { updateEntity } from "../../actions";

interface EntityEditFormProps {
  entity: Record<string, unknown>;
}

const ENTITY_TYPES: Array<{ value: string; label: string }> = [
  { value: "sci_ir", label: "SCI · IR" },
  { value: "sci_is", label: "SCI · IS" },
  { value: "sarl", label: "SARL" },
  { value: "sarl_famille", label: "SARL de famille" },
  { value: "eurl", label: "EURL" },
  { value: "sas", label: "SAS" },
  { value: "sasu", label: "SASU" },
  { value: "sa", label: "SA" },
  { value: "snc", label: "SNC" },
  { value: "indivision", label: "Indivision" },
  { value: "demembrement_usufruit", label: "Usufruit" },
  { value: "demembrement_nue_propriete", label: "Nue-propriété" },
  { value: "holding", label: "Holding" },
  { value: "particulier", label: "Personnel" },
];

const FISCAL_REGIMES: Array<{ value: string; label: string }> = [
  { value: "ir", label: "Impôt sur le Revenu (IR)" },
  { value: "is", label: "Impôt sur les Sociétés (IS)" },
  { value: "ir_option_is", label: "IR avec option IS" },
  { value: "is_option_ir", label: "IS avec option IR" },
];

export function EntityEditForm({ entity }: EntityEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { updateEntity: updateStoreEntity } = useEntityStore();

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nom: (entity.nom as string) || "",
    entity_type: (entity.entity_type as string) || "sci_ir",
    forme_juridique: (entity.forme_juridique as string) || "",
    regime_fiscal: (entity.regime_fiscal as string) || "ir",
    siret: (entity.siret as string) || "",
    capital_social: entity.capital_social ? String(entity.capital_social) : "",
    date_creation: (entity.date_creation as string) || "",
    numero_tva: (entity.numero_tva as string) || "",
    adresse_siege: (entity.adresse_siege as string) || "",
    code_postal_siege: (entity.code_postal_siege as string) || "",
    ville_siege: (entity.ville_siege as string) || "",
    iban: (entity.iban as string) || "",
    bic: (entity.bic as string) || "",
    banque_nom: (entity.banque_nom as string) || "",
  });

  const updateField = useCallback(
    (key: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = async () => {
    if (!formData.nom.trim()) {
      toast({
        title: "Erreur",
        description: "La raison sociale est obligatoire.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateEntity({
        id: entity.id as string,
        nom: formData.nom,
        entity_type: formData.entity_type as "sci_ir",
        forme_juridique: formData.forme_juridique || undefined,
        regime_fiscal: formData.regime_fiscal as "ir" | undefined,
        siret: formData.siret || undefined,
        capital_social: formData.capital_social
          ? parseFloat(formData.capital_social)
          : undefined,
        date_creation: formData.date_creation || undefined,
        numero_tva: formData.numero_tva || undefined,
        adresse_siege: formData.adresse_siege || undefined,
        code_postal_siege: formData.code_postal_siege || undefined,
        ville_siege: formData.ville_siege || undefined,
        iban: formData.iban || undefined,
        bic: formData.bic || undefined,
        banque_nom: formData.banque_nom || undefined,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update Zustand store
      updateStoreEntity(entity.id as string, {
        nom: formData.nom,
        entityType: formData.entity_type,
        siret: formData.siret || null,
        codePostalSiege: formData.code_postal_siege || null,
        villeSiege: formData.ville_siege || null,
        hasIban: !!formData.iban,
      });

      toast({
        title: "Entité modifiée",
        description: `${formData.nom} a été mise à jour.`,
      });

      router.push(`/owner/entities/${entity.id}`);
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de modifier l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/owner/entities/${entity.id}`}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à la fiche
        </Link>
        <h1 className="text-2xl font-bold">Modifier l&apos;entité</h1>
        <p className="text-muted-foreground">
          {entity.nom as string}
        </p>
      </div>

      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nom">
              Raison sociale <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nom"
              value={formData.nom}
              onChange={(e) => updateField("nom", e.target.value)}
              placeholder="Ex: SCI Mon Patrimoine"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entity_type">Type d&apos;entité</Label>
              <select
                id="entity_type"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.entity_type}
                onChange={(e) => updateField("entity_type", e.target.value)}
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forme_juridique">Forme juridique</Label>
              <Input
                id="forme_juridique"
                value={formData.forme_juridique}
                onChange={(e) =>
                  updateField("forme_juridique", e.target.value)
                }
                placeholder="Ex: Société Civile Immobilière"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regime_fiscal">Régime fiscal</Label>
              <select
                id="regime_fiscal"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formData.regime_fiscal}
                onChange={(e) =>
                  updateField("regime_fiscal", e.target.value)
                }
              >
                {FISCAL_REGIMES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital_social">Capital social</Label>
              <Input
                id="capital_social"
                type="number"
                value={formData.capital_social}
                onChange={(e) =>
                  updateField("capital_social", e.target.value)
                }
                placeholder="Ex: 1000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Immatriculation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Immatriculation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                value={formData.siret}
                onChange={(e) => updateField("siret", e.target.value)}
                placeholder="14 chiffres"
                maxLength={17}
              />
              <p className="text-xs text-muted-foreground">
                14 chiffres, utilisé dans les documents légaux
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_tva">N° TVA intracommunautaire</Label>
              <Input
                id="numero_tva"
                value={formData.numero_tva}
                onChange={(e) =>
                  updateField("numero_tva", e.target.value)
                }
                placeholder="FR + 11 chiffres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_creation">Date de création</Label>
              <Input
                id="date_creation"
                type="date"
                value={formData.date_creation}
                onChange={(e) =>
                  updateField("date_creation", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Siège social */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Siège social</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adresse_siege">Adresse</Label>
            <Input
              id="adresse_siege"
              value={formData.adresse_siege}
              onChange={(e) =>
                updateField("adresse_siege", e.target.value)
              }
              placeholder="Numéro et rue"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code_postal_siege">Code postal</Label>
              <Input
                id="code_postal_siege"
                value={formData.code_postal_siege}
                onChange={(e) =>
                  updateField("code_postal_siege", e.target.value)
                }
                placeholder="75001"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ville_siege">Ville</Label>
              <Input
                id="ville_siege"
                value={formData.ville_siege}
                onChange={(e) =>
                  updateField("ville_siege", e.target.value)
                }
                placeholder="Paris"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bancaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coordonnées bancaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) => updateField("iban", e.target.value)}
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bic">BIC</Label>
              <Input
                id="bic"
                value={formData.bic}
                onChange={(e) => updateField("bic", e.target.value)}
                placeholder="BNPAFRPP"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="banque_nom">Nom de la banque</Label>
              <Input
                id="banque_nom"
                value={formData.banque_nom}
                onChange={(e) =>
                  updateField("banque_nom", e.target.value)
                }
                placeholder="Ex: BNP Paribas"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 sticky bottom-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-3 px-4 -mx-4 rounded-lg border shadow-sm">
        <Button
          variant="outline"
          onClick={() => router.push(`/owner/entities/${entity.id}`)}
          disabled={isSaving}
        >
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="min-w-[180px]">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer les modifications"
          )}
        </Button>
      </div>
    </div>
  );
}

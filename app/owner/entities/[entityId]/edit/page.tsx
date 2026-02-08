"use client";

/**
 * Page d'édition d'une entité juridique
 * /owner/entities/[entityId]/edit
 * SOTA 2026
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { LegalEntity, UpdateLegalEntityDTO } from "@/lib/types/legal-entity";
import {
  ENTITY_TYPE_LABELS,
  FISCAL_REGIME_LABELS,
} from "@/lib/types/legal-entity";

// TVA Regime options
const TVA_REGIMES = [
  { value: "franchise", label: "Franchise en base" },
  { value: "reel_simplifie", label: "Réel simplifié" },
  { value: "reel_normal", label: "Réel normal" },
  { value: "mini_reel", label: "Mini-réel" },
];

export default function EntityEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const entityId = params.entityId as string;
  const defaultTab = searchParams.get("tab") || "general";

  const [entity, setEntity] = useState<LegalEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<UpdateLegalEntityDTO>({});

  // Fetch entity
  const loadEntity = useCallback(async () => {
    try {
      const response = await fetch(`/api/owner/legal-entities/${entityId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Entité non trouvée",
            description: "Cette entité juridique n'existe pas ou a été supprimée",
            variant: "destructive",
          });
          router.push("/owner/entities");
          return;
        }
        throw new Error("Erreur lors du chargement");
      }
      const data = await response.json();
      setEntity(data.entity);
      // Initialize form data with entity values
      setFormData({
        nom: data.entity.nom,
        nom_commercial: data.entity.nom_commercial || "",
        siren: data.entity.siren || "",
        siret: data.entity.siret || "",
        rcs_ville: data.entity.rcs_ville || "",
        numero_tva: data.entity.numero_tva || "",
        code_ape: data.entity.code_ape || "",
        adresse_siege: data.entity.adresse_siege || "",
        complement_adresse: data.entity.complement_adresse || "",
        code_postal_siege: data.entity.code_postal_siege || "",
        ville_siege: data.entity.ville_siege || "",
        pays_siege: data.entity.pays_siege || "France",
        forme_juridique: data.entity.forme_juridique || "",
        capital_social: data.entity.capital_social || undefined,
        nombre_parts: data.entity.nombre_parts || undefined,
        regime_fiscal: data.entity.regime_fiscal,
        tva_assujetti: data.entity.tva_assujetti || false,
        tva_regime: data.entity.tva_regime || undefined,
        date_creation: data.entity.date_creation || "",
        date_cloture_exercice: data.entity.date_cloture_exercice || "",
        iban: data.entity.iban || "",
        bic: data.entity.bic || "",
        banque_nom: data.entity.banque_nom || "",
        notes: data.entity.notes || "",
      });
    } catch (error) {
      console.error("Error loading entity:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de l'entité",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [entityId, router, toast]);

  useEffect(() => {
    loadEntity();
  }, [loadEntity]);

  // Handle form field change
  const handleChange = (field: keyof UpdateLegalEntityDTO, value: string | number | boolean | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate required fields
      if (!formData.nom || formData.nom.trim().length < 2) {
        toast({
          title: "Erreur de validation",
          description: "Le nom doit contenir au moins 2 caractères",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/owner/legal-entities/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      toast({
        title: "Modifications enregistrées",
        description: "L'entité a été mise à jour avec succès",
      });

      router.push(`/owner/entities/${entityId}`);
    } catch (error) {
      console.error("Error saving entity:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder les modifications",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-64" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!entity) {
    return null;
  }

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/owner/entities/${entityId}`}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Modifier l'entité
                </h1>
                <p className="text-muted-foreground">
                  {entity.nom} · {ENTITY_TYPE_LABELS[entity.entity_type]}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href={`/owner/entities/${entityId}`}>Annuler</Link>
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>

          {/* Form */}
          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="address">Adresse</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscalité</TabsTrigger>
              <TabsTrigger value="banking">Bancaire</TabsTrigger>
            </TabsList>

            {/* General tab */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Informations générales</CardTitle>
                  <CardDescription>Identité et immatriculation de l'entité</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom de l'entité *</Label>
                      <Input
                        id="nom"
                        value={formData.nom || ""}
                        onChange={(e) => handleChange("nom", e.target.value)}
                        placeholder="Ex: SCI Patrimoine Familial"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nom_commercial">Nom commercial</Label>
                      <Input
                        id="nom_commercial"
                        value={formData.nom_commercial || ""}
                        onChange={(e) => handleChange("nom_commercial", e.target.value)}
                        placeholder="Optionnel"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Immatriculation</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="siren">SIREN (9 chiffres)</Label>
                        <Input
                          id="siren"
                          value={formData.siren || ""}
                          onChange={(e) => handleChange("siren", e.target.value.replace(/\D/g, "").slice(0, 9))}
                          placeholder="123456789"
                          maxLength={9}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="siret">SIRET (14 chiffres)</Label>
                        <Input
                          id="siret"
                          value={formData.siret || ""}
                          onChange={(e) => handleChange("siret", e.target.value.replace(/\D/g, "").slice(0, 14))}
                          placeholder="12345678901234"
                          maxLength={14}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rcs_ville">Ville RCS</Label>
                        <Input
                          id="rcs_ville"
                          value={formData.rcs_ville || ""}
                          onChange={(e) => handleChange("rcs_ville", e.target.value)}
                          placeholder="Paris"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numero_tva">N° TVA intracommunautaire</Label>
                        <Input
                          id="numero_tva"
                          value={formData.numero_tva || ""}
                          onChange={(e) => handleChange("numero_tva", e.target.value.toUpperCase())}
                          placeholder="FR12345678901"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="code_ape">Code APE/NAF</Label>
                        <Input
                          id="code_ape"
                          value={formData.code_ape || ""}
                          onChange={(e) => handleChange("code_ape", e.target.value.toUpperCase())}
                          placeholder="6820A"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="forme_juridique">Forme juridique</Label>
                        <Input
                          id="forme_juridique"
                          value={formData.forme_juridique || ""}
                          onChange={(e) => handleChange("forme_juridique", e.target.value)}
                          placeholder="Société Civile Immobilière"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Capital social</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="capital_social">Montant du capital (€)</Label>
                        <Input
                          id="capital_social"
                          type="number"
                          value={formData.capital_social || ""}
                          onChange={(e) => handleChange("capital_social", e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="10000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nombre_parts">Nombre de parts</Label>
                        <Input
                          id="nombre_parts"
                          type="number"
                          value={formData.nombre_parts || ""}
                          onChange={(e) => handleChange("nombre_parts", e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="1000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Dates</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="date_creation">Date de création</Label>
                        <Input
                          id="date_creation"
                          type="date"
                          value={formData.date_creation || ""}
                          onChange={(e) => handleChange("date_creation", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_cloture_exercice">Date de clôture exercice (JJ/MM)</Label>
                        <Input
                          id="date_cloture_exercice"
                          value={formData.date_cloture_exercice || ""}
                          onChange={(e) => handleChange("date_cloture_exercice", e.target.value)}
                          placeholder="31/12"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Address tab */}
            <TabsContent value="address">
              <Card>
                <CardHeader>
                  <CardTitle>Adresse du siège</CardTitle>
                  <CardDescription>Adresse officielle de l'entité</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="adresse_siege">Adresse</Label>
                    <Input
                      id="adresse_siege"
                      value={formData.adresse_siege || ""}
                      onChange={(e) => handleChange("adresse_siege", e.target.value)}
                      placeholder="123 rue de la République"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="complement_adresse">Complément d'adresse</Label>
                    <Input
                      id="complement_adresse"
                      value={formData.complement_adresse || ""}
                      onChange={(e) => handleChange("complement_adresse", e.target.value)}
                      placeholder="Bâtiment A, 2ème étage"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="code_postal_siege">Code postal</Label>
                      <Input
                        id="code_postal_siege"
                        value={formData.code_postal_siege || ""}
                        onChange={(e) => handleChange("code_postal_siege", e.target.value)}
                        placeholder="75001"
                        maxLength={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ville_siege">Ville</Label>
                      <Input
                        id="ville_siege"
                        value={formData.ville_siege || ""}
                        onChange={(e) => handleChange("ville_siege", e.target.value)}
                        placeholder="Paris"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pays_siege">Pays</Label>
                      <Input
                        id="pays_siege"
                        value={formData.pays_siege || ""}
                        onChange={(e) => handleChange("pays_siege", e.target.value)}
                        placeholder="France"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Fiscal tab */}
            <TabsContent value="fiscal">
              <Card>
                <CardHeader>
                  <CardTitle>Fiscalité</CardTitle>
                  <CardDescription>Régime fiscal et TVA</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="regime_fiscal">Régime fiscal</Label>
                    <Select
                      value={formData.regime_fiscal}
                      onValueChange={(value) => handleChange("regime_fiscal", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un régime" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FISCAL_REGIME_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">TVA</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="tva_assujetti">Assujetti à la TVA</Label>
                          <p className="text-sm text-muted-foreground">
                            Activez si l'entité est assujettie à la TVA
                          </p>
                        </div>
                        <Switch
                          id="tva_assujetti"
                          checked={formData.tva_assujetti || false}
                          onCheckedChange={(checked) => handleChange("tva_assujetti", checked)}
                        />
                      </div>

                      {formData.tva_assujetti && (
                        <div className="space-y-2">
                          <Label htmlFor="tva_regime">Régime de TVA</Label>
                          <Select
                            value={formData.tva_regime || ""}
                            onValueChange={(value) => handleChange("tva_regime", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un régime" />
                            </SelectTrigger>
                            <SelectContent>
                              {TVA_REGIMES.map((regime) => (
                                <SelectItem key={regime.value} value={regime.value}>
                                  {regime.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Banking tab */}
            <TabsContent value="banking">
              <Card>
                <CardHeader>
                  <CardTitle>Coordonnées bancaires</CardTitle>
                  <CardDescription>Compte pour les encaissements de loyers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="iban">IBAN</Label>
                    <Input
                      id="iban"
                      value={formData.iban || ""}
                      onChange={(e) => handleChange("iban", e.target.value.toUpperCase().replace(/\s/g, ""))}
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="bic">BIC/SWIFT</Label>
                      <Input
                        id="bic"
                        value={formData.bic || ""}
                        onChange={(e) => handleChange("bic", e.target.value.toUpperCase())}
                        placeholder="BNPAFRPP"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="banque_nom">Nom de la banque</Label>
                      <Input
                        id="banque_nom"
                        value={formData.banque_nom || ""}
                        onChange={(e) => handleChange("banque_nom", e.target.value)}
                        placeholder="BNP Paribas"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Informations complémentaires (usage interne)</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.notes || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Notes internes sur cette entité..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Save button (mobile) */}
          <div className="flex justify-end gap-2 sm:hidden">
            <Button variant="outline" asChild>
              <Link href={`/owner/entities/${entityId}`}>Annuler</Link>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}

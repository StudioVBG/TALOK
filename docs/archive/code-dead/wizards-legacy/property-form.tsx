"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { propertiesService } from "../services/properties.service";
import type { CreatePropertyData, UpdatePropertyData } from "../services/properties.service";
import type { ParkingDetails, Property, PropertyType, PropertyUsage } from "@/lib/types";
import { ParkingWizard } from "./parking-wizard";

interface PropertyFormProps {
  property?: Property;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string; defaultUsage: PropertyUsage }[] = [
  { value: "appartement", label: "Appartement", defaultUsage: "habitation" },
  { value: "maison", label: "Maison", defaultUsage: "habitation" },
  { value: "colocation", label: "Colocation", defaultUsage: "habitation" },
  { value: "saisonnier", label: "Saisonnier (location courte durée)", defaultUsage: "habitation" },
  { value: "local_commercial", label: "Local commercial / Boutique", defaultUsage: "local_commercial" },
  { value: "bureaux", label: "Bureaux / Tertiaire", defaultUsage: "bureaux" },
  { value: "entrepot", label: "Entrepôt / Atelier", defaultUsage: "entrepot" },
  { value: "parking", label: "Parking / Stationnement", defaultUsage: "parking" },
  { value: "fonds_de_commerce", label: "Fonds de commerce / Local mixte", defaultUsage: "fonds_de_commerce" },
];

const USAGE_OPTIONS: { value: PropertyUsage; label: string }[] = [
  { value: "habitation", label: "Habitation (Loi 89 / mobilité)" },
  { value: "local_commercial", label: "Local commercial (3-6-9, dérogatoire)" },
  { value: "bureaux", label: "Bureaux / Tertiaire (ILAT)" },
  { value: "entrepot", label: "Entrepôt / Logistique" },
  { value: "parking", label: "Parking / Stationnement" },
  { value: "fonds_de_commerce", label: "Fonds de commerce / Location-gérance" },
];

const SOUS_USAGE_OPTIONS: Record<PropertyUsage, { value: string; label: string }[]> = {
  habitation: [],
  local_commercial: [
    { value: "boutique", label: "Boutique / Retail" },
    { value: "restaurant", label: "Restaurant / Café" },
    { value: "sante", label: "Santé / Bien-être" },
    { value: "services", label: "Services / Agence" },
  ],
  bureaux: [
    { value: "open_space", label: "Plateau / Open space" },
    { value: "coworking", label: "Coworking" },
    { value: "profession_liberale", label: "Profession libérale" },
  ],
  entrepot: [
    { value: "logistique", label: "Logistique" },
    { value: "stockage", label: "Stockage" },
    { value: "atelier", label: "Atelier / Production" },
  ],
  parking: [
    { value: "individuel", label: "Box / Place individuelle" },
    { value: "collectif", label: "Parking collectif" },
    { value: "irve", label: "Parking avec IRVE" },
  ],
  fonds_de_commerce: [
    { value: "location_gerance", label: "Location-gérance" },
    { value: "cession_droit_bail", label: "Cession du droit au bail" },
    { value: "multi_activite", label: "Multi-activité" },
  ],
};

const USAGE_LABELS: Record<PropertyUsage, string> = USAGE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<PropertyUsage, string>
);

const USAGE_CHECKLISTS: Record<PropertyUsage, string[]> = {
  habitation: [
    "Diagnostics DPE et GES à jour pour la mise en location (loi climat 2025).",
    "Informer le locataire sur les charges récupérables et travaux à prévoir.",
    "Respecter les plafonds de dépôt de garantie et la notice d'information type.",
  ],
  local_commercial: [
    "Diagnostics pro : DPE tertiaire, amiante, ERP + état des risques (ERNMT).",
    "Annexes Pinel obligatoires : état des lieux, inventaires travaux (3 ans passés / 3 ans à venir), répartition charges/taxes.",
    "Choisir l'indice ILC pour l'indexation et prévoir le lissage 10%/an en cas de déplafonnement.",
    "Option TVA sur loyers : activer si nécessaire et préparer le journal de TVA.",
    "Gérer le droit de préférence du locataire en cas de vente du local.",
  ],
  bureaux: [
    "Diagnostics tertiaires (DPE, amiante, accessibilité ERP le cas échéant).",
    "Annexes Pinel identiques aux baux commerciaux : inventaires travaux, répartition des charges.",
    "Utiliser l'indice ILAT pour l'indexation et planifier les échéances.",
    "Vérifier les obligations d'accessibilité ERP et la convention de services (internet, sécurité).",
  ],
  entrepot: [
    "Diagnostics amiante, sécurité incendie et conformité installation électrique.",
    "Annexes Pinel : état des lieux détaillé, charges, travaux lourds vs locataire.",
    "Indexation ILC recommandée (activité logistique / artisanale).",
    "Penser aux autorisations ICPE si stockage matières sensibles.",
  ],
  parking: [
    "Contrat de stationnement dédié (mensuel/annuel) avec règles d'accès.",
    "Suivi des badges, contrôle d'accès et responsabilité assurance.",
    "Refacturer énergie IRVE si bornes électriques présentes.",
  ],
  fonds_de_commerce: [
    "Contrat de location-gérance ou cession du droit au bail structuré.",
    "Publication dans un journal d'annonces légales sous 15 jours (LG) et suivi de la solidarité.",
    "Tenir un inventaire des éléments du fonds et du droit au bail.",
    "Prévoir clauses de cession et agrément conformes à la loi Pinel.",
  ],
};

const PROFESSIONAL_USAGES: PropertyUsage[] = [
  "local_commercial",
  "bureaux",
  "entrepot",
  "parking",
  "fonds_de_commerce",
];

const createDefaultParkingDetails = (): ParkingDetails => ({
  placement_type: "outdoor",
  linked_property_id: null,
  reference_label: null,
  level: null,
  vehicle_profile: "city",
  dimensions: {
    length: null,
    width: null,
    height: null,
  },
  manoeuvre: {
    narrow_ramp: false,
    sharp_turn: false,
    suitable_large_vehicle: false,
  },
  surface_type: null,
  access_types: ["badge"],
  access_window: {
    mode: "24_7",
    open_at: null,
    close_at: null,
  },
  security_features: [],
  description_hint: null,
  extra_badge_fees: null,
});

export function PropertyForm({ property, onSuccess, onCancel }: PropertyFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreatePropertyData>({
    type: "appartement",
    usage_principal: "habitation",
    sous_usage: null,
    adresse_complete: "",
    code_postal: "",
    ville: "",
    departement: "",
    surface: 0,
    nb_pieces: 1,
    etage: null,
    ascenseur: false,
    energie: null,
    ges: null,
    erp_type: null,
    erp_categorie: null,
    erp_accessibilite: false,
    plan_url: null,
    has_irve: false,
    places_parking: 0,
    parking_badge_count: 0,
    commercial_previous_activity: null,
  loyer_base: 0,
  charges_mensuelles: 0,
  depot_garantie: 0,
  zone_encadrement: false,
  loyer_reference_majoré: null,
  complement_loyer: null,
  complement_justification: null,
  dpe_classe_energie: null,
  dpe_classe_climat: null,
  dpe_consommation: null,
  dpe_emissions: null,
  dpe_estimation_conso_min: null,
  dpe_estimation_conso_max: null,
  permis_louer_requis: false,
  permis_louer_numero: null,
  permis_louer_date: null,
    parking_details: null,
  });
  const [usageTouched, setUsageTouched] = useState(false);
  const [ownerProperties, setOwnerProperties] = useState<Property[]>([]);
  const isLocked = property ? !["draft", "rejected"].includes(property.etat) : false;
  const isDisabled = loading || isLocked;
  const totalLoyer = useMemo(
    () => Number(formData.loyer_base || 0) + Number(formData.charges_mensuelles || 0),
    [formData.loyer_base, formData.charges_mensuelles]
  );
  const dpeClassIsG = formData.dpe_classe_energie === "G";
  const isParking = formData.type === "parking";

  useEffect(() => {
    if (property) {
      setFormData({
        type: property.type,
        usage_principal: property.usage_principal,
        sous_usage: property.sous_usage ?? null,
        adresse_complete: property.adresse_complete,
        code_postal: property.code_postal,
        ville: property.ville,
        departement: property.departement,
        surface: property.surface,
        nb_pieces: property.nb_pieces,
        etage: property.etage,
        ascenseur: property.ascenseur,
        energie: property.energie,
        ges: property.ges,
        erp_type: property.erp_type ?? null,
        erp_categorie: property.erp_categorie ?? null,
        erp_accessibilite: property.erp_accessibilite,
        plan_url: property.plan_url ?? null,
        has_irve: property.has_irve,
        places_parking: property.places_parking,
        parking_badge_count: property.parking_badge_count,
        commercial_previous_activity: property.commercial_previous_activity ?? null,
        loyer_base: property.loyer_base ?? 0,
        charges_mensuelles: property.charges_mensuelles ?? 0,
        depot_garantie: property.depot_garantie ?? 0,
        zone_encadrement: property.zone_encadrement ?? false,
        loyer_reference_majoré: property.loyer_reference_majoré ?? null,
        complement_loyer: property.complement_loyer ?? null,
        complement_justification: property.complement_justification ?? null,
        dpe_classe_energie: property.dpe_classe_energie ?? null,
        dpe_classe_climat: property.dpe_classe_climat ?? null,
        dpe_consommation: property.dpe_consommation ?? null,
        dpe_emissions: property.dpe_emissions ?? null,
        dpe_estimation_conso_min: property.dpe_estimation_conso_min ?? null,
        dpe_estimation_conso_max: property.dpe_estimation_conso_max ?? null,
        permis_louer_requis: property.permis_louer_requis ?? false,
        permis_louer_numero: property.permis_louer_numero ?? null,
        permis_louer_date: property.permis_louer_date ?? null,
        parking_details: property.parking_details ?? null,
      });
      setUsageTouched(true);
    }
  }, [property]);

  useEffect(() => {
    if (usageTouched) return;
    const option = PROPERTY_TYPE_OPTIONS.find((opt) => opt.value === formData.type);
    if (!option) return;
    setFormData((prev) => {
      if (prev.usage_principal === option.defaultUsage) {
        return prev;
      }
      return { ...prev, usage_principal: option.defaultUsage };
    });
  }, [formData.type, usageTouched]);

  useEffect(() => {
    propertiesService
      .getProperties()
      .then(setOwnerProperties)
      .catch(() => setOwnerProperties([]));
  }, []);

  useEffect(() => {
    setFormData((prev) => {
      if (prev.type === "parking") {
        const needsDetails = !prev.parking_details;
        const needsUsage = prev.usage_principal !== "parking";
        const needsNbPieces = prev.nb_pieces !== 0;
        const needsSurface = prev.surface !== 0;
        if (!needsDetails && !needsUsage && !needsNbPieces && !needsSurface) {
          return prev;
        }
        return {
          ...prev,
          parking_details: prev.parking_details ?? createDefaultParkingDetails(),
          usage_principal: "parking",
          nb_pieces: 0,
          surface: 0,
        };
      }
      if (prev.parking_details) {
        return { ...prev, parking_details: null };
      }
      return prev;
    });
  }, [formData.type]);

  const sousUsageOptions = useMemo(() => {
    return SOUS_USAGE_OPTIONS[formData.usage_principal] ?? [];
  }, [formData.usage_principal]);

  const isProfessionalUsage = formData.usage_principal !== "habitation";
  const checklist = USAGE_CHECKLISTS[formData.usage_principal] ?? [];
  const showUsageChecklist = !isParking && checklist.length > 0;
  const parkingDetails = useMemo(
    () => formData.parking_details ?? createDefaultParkingDetails(),
    [formData.parking_details]
  );
  // Calculs pour l'encadrement des loyers
  const encadrementCeiling = useMemo(() => {
    if (!formData.zone_encadrement) return 0;
    const loyerRef = formData.loyer_reference_majoré ?? 0;
    const complement = formData.complement_loyer ?? 0;
    return loyerRef + complement;
  }, [formData.zone_encadrement, formData.loyer_reference_majoré, formData.complement_loyer]);
  
  const encadrementOver = useMemo(() => {
    if (!formData.zone_encadrement || encadrementCeiling === 0) return false;
    const loyerBase = formData.loyer_base ?? 0;
    return loyerBase > encadrementCeiling + 0.01; // Tolérance de 0.01€
  }, [formData.zone_encadrement, formData.loyer_base, encadrementCeiling]);
  
  const complementRequiresJustification = useMemo(() => {
    return formData.zone_encadrement && (formData.complement_loyer ?? 0) > 0;
  }, [formData.zone_encadrement, formData.complement_loyer]);
  
  const submitLabel = isLocked
    ? "Modification verrouillée"
    : loading
    ? "Enregistrement..."
    : property
    ? "Modifier"
    : "Créer";

  const handleFormChange = (changes: Partial<CreatePropertyData>) => {
    setFormData((prev) => ({
      ...prev,
      ...changes,
    }));
  };

  const handleParkingDetailsChange = (details: ParkingDetails) => {
    setFormData((prev) => ({
      ...prev,
      parking_details: details,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLocked) {
        toast({
          title: "Modification impossible",
          description:
            "Ce logement est verrouillé car il est en attente de validation ou déjà publié.",
          variant: "destructive",
        });
        return;
      }

      const payload: CreatePropertyData = {
        ...formData,
        sous_usage: formData.sous_usage || null,
        erp_type: formData.erp_type || null,
        erp_categorie: formData.erp_categorie || null,
        plan_url: formData.plan_url || null,
        commercial_previous_activity: formData.commercial_previous_activity || null,
        loyer_reference_majoré: formData.zone_encadrement
          ? formData.loyer_reference_majoré ?? null
          : null,
        complement_loyer: formData.zone_encadrement
          ? formData.complement_loyer ?? null
          : null,
        complement_justification:
          formData.zone_encadrement && (formData.complement_loyer ?? 0) > 0
            ? formData.complement_justification || null
            : null,
        dpe_classe_energie: formData.dpe_classe_energie || null,
        dpe_classe_climat: formData.dpe_classe_climat || null,
        dpe_consommation: formData.dpe_consommation ?? null,
        dpe_emissions: formData.dpe_emissions ?? null,
        dpe_estimation_conso_min: formData.dpe_estimation_conso_min ?? null,
        dpe_estimation_conso_max: formData.dpe_estimation_conso_max ?? null,
        permis_louer_requis: formData.permis_louer_requis ?? false,
        permis_louer_numero: formData.permis_louer_requis
          ? formData.permis_louer_numero || null
          : null,
        permis_louer_date: formData.permis_louer_requis
          ? formData.permis_louer_date || null
          : null,
        parking_details:
          formData.type === "parking"
            ? formData.parking_details ?? createDefaultParkingDetails()
            : null,
      };

      if (property) {
        await propertiesService.updateProperty(property.id, payload);
        toast({
          title: "Propriété mise à jour",
          description: "Les modifications ont été enregistrées.",
        });
      } else {
        await propertiesService.createProperty(payload);
        toast({
          title: "Propriété créée",
          description: "Votre logement a été ajouté avec succès.",
        });
      }
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{property ? "Modifier le logement" : "Nouveau logement"}</CardTitle>
        <CardDescription>
          {property
            ? "Modifiez les informations de votre logement"
            : "Ajoutez un nouveau logement à votre portefeuille"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLocked && property && (
          <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            Ce logement est actuellement{" "}
            <span className="font-semibold">
              {property.etat === "pending"
                ? "en attente de validation"
                : property.etat === "published"
                ? "publié"
                : "archivé"}
            </span>
            . Les modifications sont bloquées tant qu'il n'est pas revenu en brouillon.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold leading-tight">Destination & usage</h3>
                <p className="text-sm text-muted-foreground">
                  Définissez le type physique du bien et l’usage contractuel prévu.
                </p>
              </div>
              <Badge variant={isProfessionalUsage ? "warning" : "secondary"}>
                {USAGE_LABELS[formData.usage_principal]}
              </Badge>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="type">Type de bien</Label>
              <select
                id="type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.type}
                onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as PropertyType,
                    })
                }
                required
                  disabled={isDisabled}
                >
                  {PROPERTY_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="usage_principal">Usage principal</Label>
                <select
                  id="usage_principal"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.usage_principal}
                  onChange={(e) => {
                    const nextUsage = e.target.value as PropertyUsage;
                    setUsageTouched(true);
                    setFormData({
                      ...formData,
                      usage_principal: nextUsage,
                      sous_usage: null,
                    });
                  }}
                required
                  disabled={isDisabled}
                >
                  {USAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sousUsageOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="sous_usage">Sous-usage (optionnel)</Label>
                <select
                  id="sous_usage"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.sous_usage ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sous_usage: e.target.value ? e.target.value : null,
                    })
                  }
                  disabled={isDisabled}
                >
                  <option value="">Non renseigné</option>
                  {sousUsageOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showUsageChecklist && (
              <div className="space-y-2 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
                <p className="font-medium">Checklist obligations pour cet usage</p>
                <ul className="list-disc space-y-1 pl-5">
                  {checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {isProfessionalUsage ? (
                  <p className="text-xs text-yellow-800">
                    Un bailleur personne physique peut conclure un bail commercial ou professionnel.
                    Veillez à ajuster vos paramètres fiscaux (revenus fonciers vs BIC, TVA optionnelle).
                  </p>
                ) : (
                  <p className="text-xs text-yellow-800">
                    Pensez à actualiser vos diagnostics avant la signature et à joindre la notice
                    d&apos;information type.
                  </p>
                )}
              </div>
            )}
          </div>

          {isParking ? (
            <ParkingWizard
              formData={formData}
              onChange={handleFormChange}
              parkingDetails={parkingDetails}
              onParkingDetailsChange={handleParkingDetailsChange}
              existingProperties={ownerProperties}
              disabled={isDisabled}
              onCancel={onCancel}
              submitLabel={submitLabel}
            />
          ) : (
            <>
          <div className="space-y-4 rounded-lg border border-border/60 p-4">
            <h3 className="text-base font-semibold leading-tight">Coordonnées du bien</h3>
          <div className="space-y-2">
            <Label htmlFor="adresse_complete">Adresse complète</Label>
            <Input
              id="adresse_complete"
              value={formData.adresse_complete}
              onChange={(e) => setFormData({ ...formData, adresse_complete: e.target.value })}
              placeholder="123 Rue de la République"
              required
                disabled={isDisabled}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="code_postal">Code postal</Label>
              <Input
                id="code_postal"
                value={formData.code_postal}
                onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                placeholder="75001"
                maxLength={5}
                required
                  disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ville">Ville</Label>
              <Input
                id="ville"
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                placeholder="Paris"
                required
                  disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departement">Département</Label>
              <Input
                id="departement"
                value={formData.departement}
                onChange={(e) => setFormData({ ...formData, departement: e.target.value })}
                placeholder="75"
                maxLength={2}
                required
                  disabled={isDisabled}
              />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border/60 p-4">
            <h3 className="text-base font-semibold leading-tight">Caractéristiques</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="surface">Surface (m²)</Label>
              <Input
                id="surface"
                type="number"
                min="1"
                  step="0.1"
                value={formData.surface}
                onChange={(e) =>
                    setFormData({
                      ...formData,
                      surface: e.target.value ? parseFloat(e.target.value) : 0,
                    })
                  }
                  required
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nb_pieces">Nombre de pièces</Label>
                <Input
                  id="nb_pieces"
                  type="number"
                  min="1"
                  value={formData.nb_pieces}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nb_pieces: e.target.value ? Math.max(1, parseInt(e.target.value)) : 1,
                    })
                }
                required
                  disabled={isDisabled}
              />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="etage">Étage (optionnel)</Label>
              <Input
                id="etage"
                type="number"
                  value={formData.etage ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    etage: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                  disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="energie">Classe énergétique (optionnel)</Label>
              <select
                id="energie"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.energie ?? ""}
                onChange={(e) =>
                    setFormData({
                      ...formData,
                      energie: e.target.value || null,
                    })
                }
                  disabled={isDisabled}
              >
                <option value="">Non renseigné</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
                <option value="F">F</option>
                <option value="G">G</option>
              </select>
            </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ges">GES (optionnel)</Label>
              <select
                id="ges"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.ges ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ges: e.target.value || null,
                    })
                  }
                  disabled={isDisabled}
              >
                <option value="">Non renseigné</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
                <option value="F">F</option>
                <option value="G">G</option>
              </select>
            </div>
              <div className="flex items-center space-x-2 pt-6">
            <input
              type="checkbox"
              id="ascenseur"
              checked={formData.ascenseur}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      ascenseur: e.target.checked,
                    })
                  }
                  disabled={isDisabled}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="ascenseur" className="cursor-pointer">
              Ascenseur
            </Label>
          </div>
            </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <h3 className="text-base font-semibold leading-tight">Conditions financières</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="loyer_base">Loyer mensuel (hors charges)</Label>
              <Input
                id="loyer_base"
                type="number"
                min="0"
                step="0.01"
                value={formData.loyer_base}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    loyer_base: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="charges_mensuelles">Charges mensuelles</Label>
              <Input
                id="charges_mensuelles"
                type="number"
                min="0"
                step="0.01"
                value={formData.charges_mensuelles}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    charges_mensuelles: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Total charges comprises</Label>
              <Input value={totalLoyer.toFixed(2)} readOnly disabled />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="depot_garantie">Dépôt de garantie</Label>
              <Input
                id="depot_garantie"
                type="number"
                min="0"
                step="0.01"
                value={formData.depot_garantie}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    depot_garantie: e.target.value ? parseFloat(e.target.value) : 0,
                  })
                }
                disabled={isDisabled}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="zone_encadrement"
              checked={formData.zone_encadrement ?? false}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  zone_encadrement: e.target.checked,
                  loyer_reference_majoré: e.target.checked ? formData.loyer_reference_majoré ?? null : null,
                  complement_loyer: e.target.checked ? formData.complement_loyer ?? null : null,
                  complement_justification: e.target.checked
                    ? formData.complement_justification ?? null
                    : null,
                })
              }
              disabled={isDisabled}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="zone_encadrement" className="cursor-pointer">
              Adresse soumise à l'encadrement des loyers
            </Label>
          </div>

          {formData.zone_encadrement && (
            <div className="space-y-3 rounded-md border border-muted p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="loyer_reference_majoré">Loyer de référence majoré (€)</Label>
                  <Input
                    id="loyer_reference_majoré"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.loyer_reference_majoré ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        loyer_reference_majoré: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complement_loyer">Complément de loyer (€)</Label>
                  <Input
                    id="complement_loyer"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.complement_loyer ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        complement_loyer: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plafond autorisé</Label>
                  <Input value={encadrementCeiling.toFixed(2)} readOnly disabled />
                </div>
              </div>
              {complementRequiresJustification && (
                <div className="space-y-2">
                  <Label htmlFor="complement_justification">Justification du complément</Label>
                  <Textarea
                    id="complement_justification"
                    value={formData.complement_justification ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        complement_justification: e.target.value || null,
                      })
                    }
                    disabled={isDisabled}
                    rows={3}
                    placeholder="Décrivez la caractéristique exceptionnelle qui justifie le complément."
                  />
                </div>
              )}
              {encadrementOver && (
                <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  Le loyer dépasse le plafond autorisé. Réduisez le loyer de base ou ajustez vos
                  références et justificatifs.
                </div>
              )}
            </div>
          )}
        </div>

        {isProfessionalUsage && (
            <div className="space-y-4 rounded-lg border border-border/60 p-4">
              <h3 className="text-base font-semibold leading-tight">Paramètres professionnels</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="erp_type">Type ERP (optionnel)</Label>
                  <Input
                    id="erp_type"
                    value={formData.erp_type ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        erp_type: e.target.value ? e.target.value : null,
                      })
                    }
                    placeholder="Ex : ERP type M (magasin)"
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="erp_categorie">Catégorie ERP (optionnel)</Label>
                  <Input
                    id="erp_categorie"
                    value={formData.erp_categorie ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        erp_categorie: e.target.value ? e.target.value : null,
                      })
                    }
                    placeholder="Ex : 5ème catégorie"
                    disabled={isDisabled}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="erp_accessibilite"
                    checked={formData.erp_accessibilite ?? false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        erp_accessibilite: e.target.checked,
                      })
                    }
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="erp_accessibilite" className="cursor-pointer">
                    ERP conforme accessibilité
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan_url">Plan / visuels (URL)</Label>
                  <Input
                    id="plan_url"
                    value={formData.plan_url ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        plan_url: e.target.value ? e.target.value : null,
                      })
                    }
                    placeholder="https://..."
                    disabled={isDisabled}
                  />
                </div>
              </div>

              {(formData.usage_principal === "fonds_de_commerce" ||
                formData.usage_principal === "local_commercial") && (
                <div className="space-y-2">
                  <Label htmlFor="commercial_previous_activity">
                    Activité précédente / fonds (optionnel)
                  </Label>
                  <Textarea
                    id="commercial_previous_activity"
                    value={formData.commercial_previous_activity ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commercial_previous_activity: e.target.value ? e.target.value : null,
                      })
                    }
                    placeholder="Décrivez l'activité précédente ou les éléments du fonds..."
                    disabled={isDisabled}
                    rows={3}
                  />
                </div>
              )}
            </div>
        )}

        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <h3 className="text-base font-semibold leading-tight">Diagnostics énergétiques</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dpe_classe_energie">Classe énergie (DPE)</Label>
              <select
                id="dpe_classe_energie"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.dpe_classe_energie ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dpe_classe_energie: e.target.value ? (e.target.value as any) : null,
                  })
                }
                disabled={isDisabled}
              >
                <option value="">Non renseigné</option>
                {["A", "B", "C", "D", "E", "F", "G"].map((classe) => (
                  <option key={classe} value={classe}>
                    {classe}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpe_classe_climat">Classe climat (GES)</Label>
              <select
                id="dpe_classe_climat"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.dpe_classe_climat ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dpe_classe_climat: e.target.value ? (e.target.value as any) : null,
                  })
                }
                disabled={isDisabled}
              >
                <option value="">Non renseigné</option>
                {["A", "B", "C", "D", "E", "F", "G"].map((classe) => (
                  <option key={classe} value={classe}>
                    {classe}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dpe_consommation">Consommation (kWh/m².an)</Label>
              <Input
                id="dpe_consommation"
                type="number"
                min="0"
                step="0.01"
                value={formData.dpe_consommation ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dpe_consommation: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpe_emissions">Émissions (kgCO₂/m².an)</Label>
              <Input
                id="dpe_emissions"
                type="number"
                min="0"
                step="0.01"
                value={formData.dpe_emissions ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dpe_emissions: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                disabled={isDisabled}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dpe_estimation_conso_min">Estimation facture énergie (min €)</Label>
              <Input
                id="dpe_estimation_conso_min"
                type="number"
                min="0"
                step="0.01"
                value={formData.dpe_estimation_conso_min ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dpe_estimation_conso_min: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                disabled={isDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dpe_estimation_conso_max">Estimation facture énergie (max €)</Label>
              <Input
                id="dpe_estimation_conso_max"
                type="number"
                min="0"
                step="0.01"
                value={formData.dpe_estimation_conso_max ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dpe_estimation_conso_max: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                disabled={isDisabled}
              />
            </div>
          </div>
          {dpeClassIsG && (
            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              Les logements classés G seront interdits à la location à partir de 2025. Pensez à
              engager des travaux ou à fournir un DPE rénové avant soumission.
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <h3 className="text-base font-semibold leading-tight">Permis de louer & obligations locales</h3>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="permis_louer_requis"
              checked={formData.permis_louer_requis ?? false}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  permis_louer_requis: e.target.checked,
                  permis_louer_numero: e.target.checked ? formData.permis_louer_numero ?? null : null,
                  permis_louer_date: e.target.checked ? formData.permis_louer_date ?? null : null,
                })
              }
              disabled={isDisabled}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="permis_louer_requis" className="cursor-pointer">
              Permis de louer requis pour cette commune
            </Label>
          </div>
          {formData.permis_louer_requis && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="permis_louer_numero">Numéro d'autorisation</Label>
                <Input
                  id="permis_louer_numero"
                  value={formData.permis_louer_numero ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      permis_louer_numero: e.target.value || null,
                    })
                  }
                  disabled={isDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="permis_louer_date">Date d'obtention</Label>
                <Input
                  id="permis_louer_date"
                  type="date"
                  value={formData.permis_louer_date ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      permis_louer_date: e.target.value || null,
                    })
                  }
                  disabled={isDisabled}
                />
              </div>
            </div>
          )}
        </div>

        {PROFESSIONAL_USAGES.includes(formData.usage_principal) && (
            <div className="space-y-4 rounded-lg border border-border/60 p-4">
              <h3 className="text-base font-semibold leading-tight">
                Stationnement & équipements
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="places_parking">Places / boxes</Label>
                  <Input
                    id="places_parking"
                    type="number"
                    min="0"
                    value={formData.places_parking ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        places_parking: e.target.value ? Math.max(0, parseInt(e.target.value)) : 0,
                      })
                    }
                    disabled={isDisabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parking_badge_count">Badges / accès</Label>
                  <Input
                    id="parking_badge_count"
                    type="number"
                    min="0"
                    value={formData.parking_badge_count ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        parking_badge_count: e.target.value
                          ? Math.max(0, parseInt(e.target.value))
                          : 0,
                      })
                    }
                    disabled={isDisabled}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="has_irve"
                  checked={formData.has_irve ?? false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      has_irve: e.target.checked,
                    })
                  }
                  disabled={isDisabled}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="has_irve" className="cursor-pointer">
                  IRVE (borne de recharge) disponible
                </Label>
              </div>
            </div>
          )}
          </>
        )}

        {!isParking && (
          <div className="flex flex-wrap justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={isDisabled}>
              {submitLabel}
            </Button>
          </div>
        )}
        </form>
      </CardContent>
    </Card>
  );
}


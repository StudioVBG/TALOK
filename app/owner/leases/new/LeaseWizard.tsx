"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Send,
  Loader2,
  Calendar,
  Euro,
  Building2,
  Users,
  Eye,
  Printer,
  Store
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { numberToWords } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

import { LeaseTypeCards, LEASE_TYPE_CONFIGS, getAvailableLeaseTypes, type LeaseType } from "./LeaseTypeCards";
import { PropertySelector } from "./PropertySelector";
import { TenantInvite } from "./TenantInvite";
import { ColocationConfig, DEFAULT_COLOCATION_CONFIG, type ColocationConfigData } from "./ColocationConfig";
import { MultiTenantInvite, type Invitee } from "./MultiTenantInvite";
import { GarantForm, type Garant } from "./GarantForm";
import { LeasePreview } from "@/features/leases/components/lease-preview";
import { RentControlAlert } from "@/components/lease/RentControlAlert";
import { DomTomDiagnostics } from "@/components/lease/DomTomDiagnostics";
import { CustomClauses } from "@/components/lease/CustomClauses";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { BailComplet } from "@/lib/templates/bail/types";

// ✅ BIC Compliance: Inventaire mobilier + Régime fiscal
import { FurnitureInventoryStep, createInitialInventory, type FurnitureInventoryData } from "./FurnitureInventoryStep";
import { TaxRegimeSelector, type TaxRegimeData, createInitialTaxRegime } from "./TaxRegimeSelector";

// ✅ Import pour les données profil
import { useAuth } from "@/lib/hooks/use-auth";
import { ownerProfilesService } from "@/features/profiles/services/owner-profiles.service";
import type { OwnerProfile } from "@/lib/types";

// ✅ SOTA 2026: Import EntitySelector pour la sélection d'entité signataire
import { EntitySelector } from "@/components/entities/EntitySelector";
import { useEntityStore } from "@/stores/useEntityStore";

// Interface étendue pour inclure toutes les données nécessaires au bail
interface Property {
  id: string;
  adresse_complete?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type?: string;
  surface?: number;
  surface_habitable_m2?: number | null;
  nb_pieces?: number;
  loyer_hc?: number;
  loyer_base?: number;
  charges_mensuelles?: number; // ✅ Colonne réelle dans properties
  charges_forfaitaires?: number; // Fallback
  dpe_classe_energie?: string | null; // "A" | "B" ...
  dpe_classe_climat?: string | null;
  dpe_consommation?: number | null;
  dpe_estimation_conso_min?: number | null;
  dpe_estimation_conso_max?: number | null;
  etage?: number;
  energie?: string; // Legacy ?
  ges?: string; // Legacy ?
  chauffage_type?: string | null;
  eau_chaude_type?: string | null;
  annee_construction?: number | null; // À vérifier si dispo
}

interface LeaseWizardProps {
  properties: Property[];
  initialPropertyId?: string;
}

// Étapes du wizard
const STEPS = [
  { id: 1, title: "Type de bail", icon: FileText },
  { id: 2, title: "Bien concerné", icon: Building2 },
  { id: 3, title: "Finalisation", icon: Users },
] as const;

// Calcul automatique de la date de fin
function calculateEndDate(startDate: string, durationMonths: number): string {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);
  end.setDate(end.getDate() - 1);
  return end.toISOString().split("T")[0];
}

export function LeaseWizard({ properties, initialPropertyId }: LeaseWizardProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ✅ Hooks pour les données utilisateur
  const { profile } = useAuth();
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);

  // ✅ SOTA 2026: Sélection d'entité signataire
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const { entities } = useEntityStore();

  // État du wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ✅ SOTA 2026: Refs pour auto-scroll et focus
  const loyerInputRef = useRef<HTMLInputElement>(null);
  const financialSectionRef = useRef<HTMLDivElement>(null);

  // Données du formulaire
  const [selectedType, setSelectedType] = useState<LeaseType | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(initialPropertyId || null);
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [creationMode, setCreationMode] = useState<"invite" | "manual">("invite");

  // Données financières (pré-remplies depuis le bien)
  const [loyer, setLoyer] = useState<number>(0);
  const [charges, setCharges] = useState<number>(0);
  const [depot, setDepot] = useState<number>(0);
  const [chargesType, setChargesType] = useState<"forfait" | "provisions">("forfait");
  const [dateDebut, setDateDebut] = useState<string>(new Date().toISOString().split("T")[0]);
  
  // ✅ États pour la colocation
  const [colocConfig, setColocConfig] = useState<ColocationConfigData>(DEFAULT_COLOCATION_CONFIG);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  
  // ✅ États pour le garant
  const [hasGarant, setHasGarant] = useState(false);
  const [garant, setGarant] = useState<Garant | null>(null);

  // ✅ P2-6: Clauses personnalisables
  const [customClauses, setCustomClauses] = useState<{ id: string; text: string; isCustom: boolean }[]>([]);

  // ✅ BIC Compliance: Inventaire mobilier obligatoire (Décret 2015-981)
  const [furnitureInventory, setFurnitureInventory] = useState<FurnitureInventoryData>(createInitialInventory());

  // ✅ BIC Compliance: Régime fiscal meublé
  const [taxRegime, setTaxRegime] = useState<TaxRegimeData>(createInitialTaxRegime());

  // ✅ Champs spécifiques baux commerciaux (Code de Commerce Art. L.145-1+)
  const [destinationBail, setDestinationBail] = useState("");
  const [activiteAutorisee, setActiviteAutorisee] = useState("");
  const [indexationType, setIndexationType] = useState<"ILC" | "ILAT" | "IRL" | "">(
    ""
  );
  const [sousLocationAutorisee, setSousLocationAutorisee] = useState(false);
  const [droitPreference, setDroitPreference] = useState(true);

  // ✅ Champs spécifiques location-gérance
  const [redevanceGerance, setRedevanceGerance] = useState<number>(0);
  const [fondsDescription, setFondsDescription] = useState("");

  // Vérifier si c'est un bail colocation
  const isColocation = selectedType === "colocation";

  // ✅ Déterminer si le bail est meublé (BIC)
  const isFurnishedLease = ["meuble", "bail_mobilite", "etudiant"].includes(selectedType || "");

  // ✅ Déterminer si c'est un bail commercial/professionnel/gérance
  const isCommercialLease = ["commercial_3_6_9", "commercial_derogatoire"].includes(selectedType || "");
  const isProfessionalLease = selectedType === "professionnel";
  const isLocationGerance = selectedType === "location_gerance";

  // ✅ P2-9: Auto-save du wizard
  const autoSaveData = useMemo(() => ({
    selectedType, selectedPropertyId, selectedEntityId,
    loyer, charges, depot, chargesType, dateDebut,
    tenantEmail, tenantName, creationMode,
    colocConfig, invitees, hasGarant, garant, customClauses,
    furnitureInventory, taxRegime,
  }), [
    selectedType, selectedPropertyId, selectedEntityId,
    loyer, charges, depot, chargesType, dateDebut,
    tenantEmail, tenantName, creationMode,
    colocConfig, invitees, hasGarant, garant, customClauses,
    furnitureInventory, taxRegime,
  ]);

  const { clearSaved: clearAutoSave } = useAutoSave({
    key: "lease-wizard",
    data: autoSaveData,
    onRestore: useCallback((saved: typeof autoSaveData) => {
      if (saved.selectedType) setSelectedType(saved.selectedType);
      if (saved.selectedPropertyId) setSelectedPropertyId(saved.selectedPropertyId);
      if (saved.selectedEntityId) setSelectedEntityId(saved.selectedEntityId);
      if (saved.loyer) setLoyer(saved.loyer);
      if (saved.charges) setCharges(saved.charges);
      if (saved.depot != null) setDepot(saved.depot);
      if (saved.chargesType) setChargesType(saved.chargesType);
      if (saved.dateDebut) setDateDebut(saved.dateDebut);
      if (saved.tenantEmail) setTenantEmail(saved.tenantEmail);
      if (saved.tenantName) setTenantName(saved.tenantName);
      if (saved.creationMode) setCreationMode(saved.creationMode);
      if (saved.colocConfig) setColocConfig(saved.colocConfig);
      if (saved.invitees) setInvitees(saved.invitees);
      if (saved.hasGarant != null) setHasGarant(saved.hasGarant);
      if (saved.garant) setGarant(saved.garant);
      if (saved.customClauses) setCustomClauses(saved.customClauses);
      if (saved.furnitureInventory) setFurnitureInventory(saved.furnitureInventory);
      if (saved.taxRegime) setTaxRegime(saved.taxRegime);
      toast({ title: "Brouillon restauré", description: "Votre saisie précédente a été récupérée.", duration: 3000 });
    }, [toast]),
  });

  // ✅ Charger les infos supplémentaires du propriétaire (adresse, etc.)
  useEffect(() => {
    async function loadOwnerData() {
      try {
        const data = await ownerProfilesService.getMyOwnerProfile();
        if (data) setOwnerProfile(data);
      } catch (err) {
        console.error("Erreur chargement profil owner:", err);
      }
    }
    loadOwnerData();
  }, []);

  // Propriété sélectionnée
  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  );

  // Configuration du type de bail sélectionné
  const leaseConfig = selectedType ? LEASE_TYPE_CONFIGS[selectedType] : null;

  // P1-4 SOTA 2026: Durée bail SCI = 6 ans min (loi 89-462 art. 10)
  // Si l'entité signataire est une SCI/SARL/SAS et le bail est habitation, durée = 72 mois
  const effectiveDurationMonths = useMemo(() => {
    if (!leaseConfig || !selectedEntityId) return leaseConfig?.durationMonths ?? 12;
    const entity = entities.find((e) => e.id === selectedEntityId);
    if (!entity) return leaseConfig.durationMonths;
    const isPersonneMorale = !["particulier"].includes(entity.entityType);
    const isHabitation = ["nu", "bail_mixte"].includes(selectedType || "");
    if (isPersonneMorale && isHabitation && leaseConfig.durationMonths < 72) {
      return 72; // 6 ans minimum pour personne morale bailleur
    }
    return leaseConfig.durationMonths;
  }, [leaseConfig, selectedEntityId, entities, selectedType]);

  // Date de fin calculée
  const dateFin = useMemo(() => {
    if (!dateDebut || !leaseConfig) return null;
    return calculateEndDate(dateDebut, effectiveDurationMonths);
  }, [dateDebut, leaseConfig, effectiveDurationMonths]);

  // Dépôt max légal
  const maxDepot = useMemo(() => {
    if (!leaseConfig || !loyer) return null;
    return loyer * leaseConfig.maxDepositMonths;
  }, [leaseConfig, loyer]);

  // Données pour l'aperçu
  const previewData = useMemo(() => {
    if (!selectedProperty || !selectedType) return {};

    // S'assurer que surface > 0, sinon undefined pour afficher les pointillés
    const surface = selectedProperty.surface_habitable_m2 || selectedProperty.surface;
    const surfaceValid = surface && surface > 0 ? surface : undefined;

    return {
      reference: "BROUILLON",
      date_signature: undefined, // Laisser vide pour signature manuelle ou électronique
      lieu_signature: selectedProperty.ville || "...",
      
      // ✅ SOTA 2026: Bailleur — utilise l'entité si sélectionnée, sinon profil personnel
      bailleur: (() => {
        const selectedEntity = selectedEntityId
          ? entities.find((e) => e.id === selectedEntityId)
          : null;

        if (selectedEntity) {
          return {
            nom: selectedEntity.nom || undefined,
            prenom: "",
            adresse: undefined, // Sera rempli par resolveOwnerIdentity au moment du PDF
            code_postal: "",
            ville: "",
            telephone: profile?.telephone || undefined,
            email: (profile as any)?.email || undefined,
            type: "societe" as const,
            raison_sociale: selectedEntity.nom,
            forme_juridique: selectedEntity.legalForm || "",
            siret: selectedEntity.siret || "",
          };
        }

        return {
          nom: profile?.nom || undefined,
          prenom: profile?.prenom || undefined,
          adresse: ownerProfile?.adresse_facturation || undefined,
          code_postal: "",
          ville: "",
          telephone: profile?.telephone || undefined,
          email: (profile as any)?.email || undefined,
          type: ownerProfile?.type || "particulier",
        };
      })(),

      // Locataire(s)
      locataires: isColocation 
        ? invitees.map(i => ({
            nom: i.name || "____________________",
            prenom: "",
            email: i.email,
            telephone: "",
            date_naissance: undefined,
            lieu_naissance: "",
            nationalite: ""
          }))
        : [{
            nom: tenantName || (creationMode === 'manual' ? "____________________" : "[NOM LOCATAIRE]"),
            prenom: "",
            email: tenantEmail,
            telephone: "",
            date_naissance: undefined,
            lieu_naissance: "",
            nationalite: ""
          }],

      // Logement
      logement: {
        adresse_complete: selectedProperty.adresse_complete || selectedProperty.adresse || "",
        code_postal: selectedProperty.code_postal || "",
        ville: selectedProperty.ville || "",
        type: selectedProperty.type || "appartement",
        surface_habitable: surfaceValid, // ✅ 0 m² corrigé
        nb_pieces_principales: selectedProperty.nb_pieces || 1,
        etage: selectedProperty.etage,
        epoque_construction: selectedProperty.annee_construction ? String(selectedProperty.annee_construction) : undefined, // ✅ undefined pour pointillés
        chauffage_type: selectedProperty.chauffage_type || undefined,
        eau_chaude_type: selectedProperty.eau_chaude_type || undefined,
        equipements_privatifs: [], // Vide pour l'instant
        parties_communes: [],
        annexes: [],
      },

      // Conditions
      conditions: {
        date_debut: dateDebut,
        date_fin: dateFin || undefined,
        duree_mois: effectiveDurationMonths,
        tacite_reconduction: true,
        loyer_hc: loyer,
        loyer_en_lettres: numberToWords(loyer),
        charges_montant: charges,
        charges_type: chargesType,
        depot_garantie: depot,
        depot_garantie_en_lettres: numberToWords(depot),
        mode_paiement: "virement",
        periodicite_paiement: "mensuelle",
        jour_paiement: 5,
        paiement_avance: true,
        revision_autorisee: true,
      },

      // Diagnostics (Données réelles ou undefined)
      diagnostics: {
        dpe: {
          date_realisation: undefined, // Laisser vide si non connu
          classe_energie: selectedProperty.dpe_classe_energie || selectedProperty.energie || undefined,
          classe_ges: selectedProperty.dpe_classe_climat || selectedProperty.ges || undefined,
          consommation_energie: selectedProperty.dpe_consommation || undefined,
          estimation_cout_min: selectedProperty.dpe_estimation_conso_min || undefined,
          estimation_cout_max: selectedProperty.dpe_estimation_conso_max || undefined,
        },
      },

      // Clauses additionnelles
      clauses_additionnelles: customClauses.length > 0 ? customClauses.map(c => c.text) : undefined,

      // Garant (si défini)
      garants: hasGarant && garant ? [{
        nom: garant.nom,
        prenom: garant.prenom,
        adresse: garant.adresse,
        code_postal: garant.code_postal,
        ville: garant.ville,
        email: garant.email,
        telephone: garant.telephone,
        type_garantie: garant.type_garantie,
        date_naissance: garant.date_naissance,
        lieu_naissance: garant.lieu_naissance,
        lien_parente: garant.lien_parente,
        raison_sociale: garant.raison_sociale,
        siret: garant.siret,
      }] : undefined,
    };
  }, [
    selectedProperty, 
    selectedType, 
    loyer, 
    charges, 
    depot, 
    dateDebut, 
    dateFin, 
    tenantName, 
    tenantEmail, 
    creationMode, 
    isColocation, 
    invitees, 
    leaseConfig,
    profile,
    ownerProfile,
    hasGarant,
    garant,
    customClauses,
    selectedEntityId,
    entities
  ]);

  // ✅ Mapping type de bail → types de propriétés compatibles
  const PROPERTY_TYPES_BY_LEASE: Record<LeaseType, string[]> = {
    nu: ["appartement", "maison", "studio", "immeuble"],
    meuble: ["appartement", "maison", "studio", "colocation", "immeuble"],
    colocation: ["appartement", "maison", "colocation", "immeuble"],
    saisonnier: ["appartement", "maison", "studio", "saisonnier"],
    bail_mobilite: ["appartement", "maison", "studio"],
    contrat_parking: ["parking", "box"],
    commercial_3_6_9: ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce", "immeuble"],
    professionnel: ["bureaux", "local_commercial", "immeuble"],
    etudiant: ["appartement", "maison", "studio"],
    bail_mixte: ["appartement", "maison", "studio"],
    commercial_derogatoire: ["local_commercial", "bureaux", "entrepot"],
    location_gerance: ["local_commercial", "fonds_de_commerce"],
    bail_rural: ["terrain_agricole", "ferme"],
  };

  // ✅ Filtrer les propriétés selon le type de bail sélectionné
  const filteredProperties = useMemo(() => {
    if (!selectedType) return properties;
    const allowedTypes = PROPERTY_TYPES_BY_LEASE[selectedType];
    return properties.filter((p) => allowedTypes.includes(p.type || ""));
  }, [properties, selectedType]);

  // P1-5: Vérification DPE G (Loi Climat et Résilience)
  const isDpeBlocked = useMemo(() => {
    if (!selectedProperty || !selectedType) return false;
    const isHabitation = ["nu", "meuble", "colocation", "bail_mobilite", "etudiant", "bail_mixte"].includes(selectedType);
    const dpe = (selectedProperty.dpe_classe_energie || "").toUpperCase();
    return isHabitation && dpe === "G";
  }, [selectedProperty, selectedType]);

  // ✅ SOTA 2026: Gestion de la sélection de propriété avec feedback UX
  const handlePropertySelect = useCallback((property: Property) => {
    setSelectedPropertyId(property.id);
    const propAny = property as any;
    
    // Loyer : loyer_hc ou loyer_base
    const loyerValue = propAny.loyer_hc ?? propAny.loyer_base ?? 0;
    if (loyerValue > 0) setLoyer(loyerValue);
    
    // Charges : charges_mensuelles (propriété) → charges_forfaitaires (bail)
    const chargesValue = propAny.charges_mensuelles ?? propAny.charges_forfaitaires ?? 0;
    if (chargesValue > 0) setCharges(chargesValue);
    
    // Dépôt : calculer selon le type de bail
    const depotMonths = selectedType ? LEASE_TYPE_CONFIGS[selectedType].maxDepositMonths : 1;
    if (loyerValue > 0) setDepot(loyerValue * depotMonths);
    
    // ✅ SOTA 2026: Toast de confirmation
    const address = property.adresse_complete || property.adresse || "Bien";
    toast({
      title: `✓ ${address.substring(0, 30)}${address.length > 30 ? "..." : ""}`,
      description: loyerValue > 0 
        ? `Loyer pré-rempli : ${loyerValue.toLocaleString("fr-FR")} €` 
        : "⚠️ Renseignez le loyer ci-dessous",
      duration: 2000,
    });
    
    // ✅ SOTA 2026: Auto-scroll vers la section financière
    setTimeout(() => {
      if (financialSectionRef.current) {
        financialSectionRef.current.scrollIntoView({ 
          behavior: "smooth", 
          block: "start" 
        });
      }
      // Focus sur le champ loyer si pas de loyer pré-rempli
      if (loyerValue === 0 && loyerInputRef.current) {
        setTimeout(() => {
          loyerInputRef.current?.focus();
        }, 400);
      }
    }, 300);
  }, [selectedType, toast]);

  // ✅ Pré-remplissage automatique si un logement est fourni via l'URL
  useEffect(() => {
    if (initialPropertyId && properties.length > 0 && loyer === 0) {
      const property = properties.find(p => p.id === initialPropertyId);
      if (property) {
        const propAny = property as any;
        const loyerValue = propAny.loyer_hc ?? propAny.loyer_base ?? 0;
        const chargesValue = propAny.charges_mensuelles ?? propAny.charges_forfaitaires ?? 0;
        if (loyerValue > 0) setLoyer(loyerValue);
        if (chargesValue > 0) setCharges(chargesValue);
        if (loyerValue > 0) setDepot(loyerValue);
      }
    }
  }, [initialPropertyId, properties, loyer]);

  // ✅ Auto-skip étape 1 : si le bien est pré-sélectionné et qu'un seul type de bail est compatible
  const [autoSkipDone, setAutoSkipDone] = useState(false);
  useEffect(() => {
    if (autoSkipDone || !initialPropertyId || !selectedProperty || selectedType) return;
    const availableTypes = getAvailableLeaseTypes(selectedProperty.type);
    if (availableTypes.length === 1) {
      // Un seul type compatible → auto-sélection et passage direct à l'étape 2
      const onlyType = availableTypes[0];
      setSelectedType(onlyType);
      // Calculer le dépôt selon le type
      if (loyer > 0) {
        setDepot(loyer * LEASE_TYPE_CONFIGS[onlyType].maxDepositMonths);
      }
      if (onlyType === "bail_mobilite") {
        setDepot(0);
      }
      setCurrentStep(2);
      toast({
        title: `${LEASE_TYPE_CONFIGS[onlyType].name} sélectionné automatiquement`,
        description: `Seul type de bail compatible avec ce bien.`,
        duration: 3000,
      });
      setAutoSkipDone(true);
    } else {
      setAutoSkipDone(true);
    }
  }, [initialPropertyId, selectedProperty, selectedType, autoSkipDone, loyer, toast]);

  // ✅ SOTA 2026: Gestion du changement de type de bail avec auto-advance
  const handleTypeSelect = useCallback((type: LeaseType) => {
    setSelectedType(type);

    // ✅ GAP-001 FIX: Forcer dépôt à 0 pour bail mobilité (Art. 25-13 Loi ELAN)
    if (type === "bail_mobilite") {
      setDepot(0);
    } else if (loyer > 0) {
      setDepot(loyer * LEASE_TYPE_CONFIGS[type].maxDepositMonths);
    }

    // ✅ Auto-configuration de l'indice d'indexation selon le type de bail
    if (["commercial_3_6_9", "commercial_derogatoire"].includes(type)) {
      setIndexationType("ILC");
    } else if (type === "professionnel") {
      setIndexationType("ILAT");
    } else if (["nu", "meuble", "etudiant", "colocation", "bail_mixte"].includes(type)) {
      setIndexationType("IRL");
    } else {
      setIndexationType("");
    }

    // ✅ SOTA 2026: Toast de confirmation + Auto-advance
    const toastDescription = type === "bail_mobilite"
      ? "Dépôt de garantie interdit (Loi ELAN)"
      : "Type de bail sélectionné";
    toast({
      title: `✓ ${LEASE_TYPE_CONFIGS[type].name}`,
      description: toastDescription,
      duration: 1500,
    });

    // Auto-advance après 600ms pour laisser l'animation de sélection
    setTimeout(() => {
      setCurrentStep(2);
    }, 600);
  }, [loyer, toast]);

  // ✅ Correction automatique du dépôt si > max légal
  const handleDepotChange = useCallback((value: number) => {
    if (maxDepot && value > maxDepot) {
      // Si l'utilisateur entre une valeur > max, on corrige automatiquement
      setDepot(maxDepot);
    } else {
      setDepot(value);
    }
  }, [maxDepot]);

  // Validation de l'étape courante
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return selectedType !== null;
      case 2:
        // ✅ BIC: Si bail meublé, inventaire doit être complet
        if (isFurnishedLease && !furnitureInventory.isComplete) {
          return false;
        }
        return selectedPropertyId !== null && loyer > 0 && !isDpeBlocked;
      case 3:
        if (isColocation) {
          const validInvitees = invitees.filter(i => 
            i.email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email)
          );
          return validInvitees.length > 0;
        }
        if (creationMode === "manual") return true;
        return tenantEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail);
      default:
        return false;
    }
  }, [currentStep, selectedType, selectedPropertyId, loyer, tenantEmail, isColocation, invitees, creationMode]);

  // Navigation
  const goNext = () => {
    if (canProceed && currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Soumission finale
  const handleSubmit = async () => {
    // Validation différente selon le type de bail
    if (isColocation) {
      const validInvitees = invitees.filter(i => i.email);
      if (!selectedType || !selectedPropertyId || validInvitees.length === 0) {
        toast({ title: "Données manquantes", description: "Veuillez sélectionner un bien et inviter au moins un colocataire", variant: "destructive" });
        return;
      }
    } else {
      if (!selectedType || !selectedPropertyId) {
        toast({ title: "Données manquantes", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
        return;
      }
      if (creationMode === "invite" && !tenantEmail) {
        toast({ title: "Email manquant", description: "Veuillez renseigner l'email du locataire pour l'invitation", variant: "destructive" });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const colocData = isColocation ? {
        coloc_config: {
          nb_places: colocConfig.nbPlaces,
          bail_type: colocConfig.bailType,
          solidarite: colocConfig.solidarite,
          solidarite_duration_months: colocConfig.solidariteDurationMonths,
          split_mode: colocConfig.splitMode,
        },
        invitees: invitees
          .filter(i => i.email)
          .map(i => ({
            email: i.email,
            name: i.name || null,
            role: i.role,
            weight: i.weight || (1 / colocConfig.nbPlaces),
            room_label: i.roomLabel || null,
            has_guarantor: i.hasGuarantor,
            guarantor_email: i.guarantorEmail || null,
            guarantor_name: i.guarantorName || null,
          })),
      } : {};

      const response = await fetch("/api/leases/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedPropertyId,
          type_bail: selectedType,
          signatory_entity_id: selectedEntityId,
          loyer,
          charges_forfaitaires: charges,
          charges_type: chargesType,
          depot_garantie: depot,
          date_debut: dateDebut,
          date_fin: dateFin,
          custom_clauses: customClauses.length > 0 ? customClauses : undefined,
          // ✅ BIC Compliance: envoyer inventaire + régime fiscal
          ...(isFurnishedLease ? {
            tax_regime: taxRegime.regime,
            lmnp_status: taxRegime.lmnpStatus,
            furniture_inventory: furnitureInventory.items.map(item => ({
              name: item.name,
              condition: item.condition,
              quantity: item.quantity,
              is_mandatory: item.isMandatory,
            })),
            furniture_additional: furnitureInventory.additionalItems,
          } : {}),
          // ✅ Champs baux commerciaux / professionnels / location-gérance
          ...((isCommercialLease || isProfessionalLease) ? {
            destination_bail: destinationBail || undefined,
            activite_autorisee: activiteAutorisee || undefined,
            indice_reference: indexationType || undefined,
            sous_location_autorisee: sousLocationAutorisee,
            droit_preference: droitPreference,
          } : {}),
          ...(isLocationGerance ? {
            destination_bail: fondsDescription || undefined,
            redevance_gerance: redevanceGerance || undefined,
            indice_reference: indexationType || undefined,
          } : {}),
          // Indexation pour tous les baux
          ...(indexationType && !isCommercialLease && !isProfessionalLease && !isLocationGerance ? {
            indice_reference: indexationType,
          } : {}),
          ...(isColocation ? colocData : {
            tenant_email: creationMode === "invite" ? tenantEmail : null,
            tenant_name: tenantName || null,
            is_manual_draft: creationMode === "manual",
          }),
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || result.details || result.hint || "Erreur lors de la création");
      }

      // P2-9: Clear auto-save on successful submit
      clearAutoSave();

      toast({
        title: "✅ Bail créé avec succès !",
        description: creationMode === "manual" ? "Le bail vierge est prêt." : "L'invitation a été envoyée.",
      });

      router.push(`/owner/leases/${result.lease_id}`);
    } catch (error: unknown) {
      console.error("Erreur création bail:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className={cn("container mx-auto px-4 py-8", currentStep === 3 ? "max-w-7xl" : "max-w-5xl")}>
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 hover:bg-transparent">
            <Link href="/owner/leases">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux baux
            </Link>
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Nouveau bail
              </h1>
              <p className="text-muted-foreground">
                Créez un contrat en quelques clics
              </p>
            </div>
          </div>
        </div>

        {/* Stepper (masqué à l'étape 3 pour maximiser l'espace) */}
        {currentStep < 3 && (
          <div className="mb-8">
            <div className="flex items-center justify-between w-full max-w-xl mx-auto">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;
                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={false}
                        animate={{
                          scale: isActive ? 1.1 : 1,
                          backgroundColor: isCompleted ? "rgb(34 197 94)" : isActive ? "rgb(37 99 235)" : "rgb(226 232 240)",
                        }}
                        className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-colors", isActive || isCompleted ? "text-white" : "text-slate-500")}
                      >
                        {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </motion.div>
                      <span className={cn("text-xs mt-2 font-medium", isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-muted-foreground")}>
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className="flex-1 mx-4 h-0.5 bg-slate-200 dark:bg-slate-700">
                        <motion.div initial={false} animate={{ width: currentStep > step.id ? "100%" : "0%" }} className="h-full bg-green-500" transition={{ duration: 0.3 }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Étape 1 : Type de bail */}
            {currentStep === 1 && (
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <LeaseTypeCards
                  selectedType={selectedType}
                  onSelect={handleTypeSelect}
                  propertyType={selectedProperty?.type}
                />
              </div>
            )}

            {/* Étape 2 : Sélection du bien */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Sélecteur d'entité signataire */}
                {entities.length > 0 && (
                  <div className="bg-white rounded-xl border shadow-sm p-6">
                    <EntitySelector
                      value={selectedEntityId}
                      onChange={setSelectedEntityId}
                      label="Entité signataire du bail"
                      hint="Sélectionnez l'entité juridique qui signera ce bail. Le bailleur sur le document sera cette entité."
                      warnMissingSiret
                      propertyEntityId={selectedProperty?.legal_entity_id || null}
                    />
                  </div>
                )}

                <div className="bg-white rounded-xl border shadow-sm p-6">
                  {initialPropertyId && selectedProperty ? (
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-blue-600">Sélectionné</Badge>
                        <p className="font-semibold">{selectedProperty.adresse_complete || selectedProperty.adresse}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedProperty.code_postal} {selectedProperty.ville} • {selectedProperty.surface} m²
                      </p>
                    </div>
                  ) : (
                    <PropertySelector
                      properties={filteredProperties as any}
                      selectedPropertyId={selectedPropertyId}
                      onSelect={handlePropertySelect}
                    />
                  )}

                  {/* P1-5: Alerte DPE G — Loi Climat et Résilience */}
                  {isDpeBlocked && (
                    <div className="mt-6 p-4 rounded-xl bg-red-50 border-2 border-red-300">
                      <p className="text-base font-bold text-red-800">Location interdite — DPE classe G</p>
                      <p className="text-sm text-red-700 mt-2">
                        Depuis le 1er janvier 2025, les logements classés G au DPE ne peuvent plus
                        faire l'objet d'un nouveau bail d'habitation (Loi Climat et Résilience, art. 160).
                      </p>
                      <p className="text-sm text-red-600 mt-1">
                        Effectuez des travaux de rénovation énergétique pour améliorer le DPE avant de louer.
                      </p>
                    </div>
                  )}

                  {/* P2-8: Encadrement des loyers + P2-5: DOM-TOM */}
                  {selectedProperty && !isDpeBlocked && (
                    <div className="mt-6 space-y-3">
                      <RentControlAlert
                        codePostal={selectedProperty.code_postal}
                        loyer={loyer}
                        surface={selectedProperty.surface}
                        typeBail={selectedType || ""}
                      />
                      <DomTomDiagnostics codePostal={selectedProperty.code_postal} />
                    </div>
                  )}

                  {/* Données financières */}
                  {selectedPropertyId && !isDpeBlocked && (
                    <div ref={financialSectionRef} className="mt-8 pt-8 border-t scroll-mt-4">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Euro className="h-5 w-5 text-amber-600" />
                        Conditions financières
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className={cn(loyer === 0 && "text-amber-600 font-semibold")}>
                            Loyer mensuel HC (€) {loyer === 0 && <span className="text-red-500">*</span>}
                          </Label>
                          <Input 
                            ref={loyerInputRef}
                            type="number" 
                            value={loyer} 
                            onChange={(e) => setLoyer(parseFloat(e.target.value) || 0)}
                            className={cn(
                              loyer === 0 && "border-amber-400 ring-2 ring-amber-200 focus:ring-amber-400"
                            )}
                            placeholder="Ex: 850"
                          />
                          {/* ✅ SOTA 2026: Message d'erreur inline */}
                          {loyer === 0 && (
                            <p className="text-xs text-amber-600 animate-pulse">
                              ⚠️ Renseignez le loyer pour continuer
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Charges (€)</Label>
                          <Input type="number" value={charges} onChange={(e) => setCharges(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Dépôt de garantie (€)</Label>
                          {/* ✅ GAP-001 FIX: Masquer champ dépôt pour bail mobilité (Art. 25-13 Loi ELAN) */}
                          {selectedType === "bail_mobilite" ? (
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                              <p className="text-sm text-amber-800 font-medium">
                                Dépôt de garantie interdit
                              </p>
                              <p className="text-xs text-amber-600 mt-1">
                                Article 25-13 de la Loi ELAN : le bail mobilité ne peut pas comporter
                                de dépôt de garantie. Vous pouvez demander une caution (garant) à la place.
                              </p>
                            </div>
                          ) : (
                            <>
                              <Input
                                type="number"
                                value={depot}
                                onChange={(e) => handleDepotChange(parseFloat(e.target.value) || 0)}
                                max={maxDepot || undefined}
                              />
                              {maxDepot && (
                                <p className="text-xs text-muted-foreground">Max légal : {maxDepot.toLocaleString("fr-FR")} €</p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="space-y-2">
                          <Label>Type de charges</Label>
                          <Select value={chargesType} onValueChange={(v: "forfait" | "provisions") => setChargesType(v)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="forfait">Forfait (montant fixe)</SelectItem>
                              <SelectItem value="provisions">Provisions (régularisation annuelle)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {chargesType === "forfait" 
                              ? "Montant fixe, pas de régularisation" 
                              : "Avance mensuelle avec régularisation annuelle"}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Date de début</Label>
                          <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                        </div>
                      </div>

                      {/* P1-4: Avertissement durée SCI */}
                      {effectiveDurationMonths > (leaseConfig?.durationMonths ?? 0) && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-sm text-amber-800 font-medium">
                            Durée ajustée : {effectiveDurationMonths / 12} ans
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            Loi 89-462, Art. 10 : lorsque le bailleur est une personne morale,
                            la durée minimum du bail est de 6 ans (au lieu de 3 ans).
                          </p>
                        </div>
                      )}
                      
                      {/* ✅ BIC Compliance: Régime fiscal pour baux meublés */}
                      {isFurnishedLease && (
                        <div className="mt-6 pt-6 border-t">
                          <TaxRegimeSelector
                            value={taxRegime}
                            onChange={setTaxRegime}
                            annualRent={loyer * 12}
                          />
                        </div>
                      )}

                      {/* ✅ BIC Compliance: Inventaire mobilier obligatoire */}
                      {isFurnishedLease && (
                        <div className="mt-6 pt-6 border-t">
                          <FurnitureInventoryStep
                            value={furnitureInventory}
                            onChange={setFurnitureInventory}
                            typeBail={selectedType || ""}
                          />
                        </div>
                      )}

                      {/* ✅ Champs spécifiques baux commerciaux (Code Commerce Art. L.145-1+) */}
                      {isCommercialLease && (
                        <div className="mt-6 pt-6 border-t">
                          <h4 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            Clauses commerciales
                          </h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Destination du bail (activité autorisée) *</Label>
                              <Input
                                value={destinationBail}
                                onChange={(e) => setDestinationBail(e.target.value)}
                                placeholder="Ex: Commerce de détail alimentaire, restauration, bureau d'études..."
                              />
                              <p className="text-xs text-muted-foreground">
                                Art. L.145-47 : le locataire ne peut exercer qu'une activité conforme à la destination du bail.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Activités autorisées complémentaires</Label>
                              <Input
                                value={activiteAutorisee}
                                onChange={(e) => setActiviteAutorisee(e.target.value)}
                                placeholder="Ex: Vente à emporter, e-commerce, stockage annexe..."
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Indice de révision du loyer</Label>
                                <Select value={indexationType} onValueChange={(v: "ILC" | "ILAT" | "IRL") => setIndexationType(v)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner l'indice" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ILC">ILC (Indice des Loyers Commerciaux)</SelectItem>
                                    <SelectItem value="ILAT">ILAT (Indice des Loyers des Activités Tertiaires)</SelectItem>
                                    <SelectItem value="IRL">IRL (Indice de Référence des Loyers)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-3">
                                <Label>Options</Label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="sous-location"
                                    checked={sousLocationAutorisee}
                                    onChange={(e) => setSousLocationAutorisee(e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <Label htmlFor="sous-location" className="text-sm font-normal cursor-pointer">
                                    Sous-location autorisée
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="droit-preference"
                                    checked={droitPreference}
                                    onChange={(e) => setDroitPreference(e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <Label htmlFor="droit-preference" className="text-sm font-normal cursor-pointer">
                                    Droit de préférence du locataire (Art. L.145-46-1)
                                  </Label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ✅ Champs spécifiques bail professionnel */}
                      {isProfessionalLease && (
                        <div className="mt-6 pt-6 border-t">
                          <h4 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-purple-600" />
                            Bail professionnel
                          </h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Activité professionnelle exercée *</Label>
                              <Input
                                value={destinationBail}
                                onChange={(e) => setDestinationBail(e.target.value)}
                                placeholder="Ex: Cabinet médical, avocat, architecte, comptable..."
                              />
                              <p className="text-xs text-muted-foreground">
                                Loi du 23/12/1986 : bail de 6 ans minimum, sans propriété commerciale.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Indice de révision</Label>
                              <Select value={indexationType} onValueChange={(v: "ILC" | "ILAT" | "IRL") => setIndexationType(v)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner l'indice" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ILAT">ILAT (Indice des Loyers des Activités Tertiaires)</SelectItem>
                                  <SelectItem value="ILC">ILC (Indice des Loyers Commerciaux)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ✅ Champs spécifiques location-gérance */}
                      {isLocationGerance && (
                        <div className="mt-6 pt-6 border-t">
                          <h4 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Store className="h-4 w-4 text-orange-600" />
                            Location-gérance
                          </h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Description du fonds de commerce *</Label>
                              <Input
                                value={fondsDescription}
                                onChange={(e) => setFondsDescription(e.target.value)}
                                placeholder="Ex: Fonds de commerce de boulangerie-pâtisserie comprenant..."
                              />
                              <p className="text-xs text-muted-foreground">
                                Art. L.144-1 Code Commerce : la location-gérance porte sur un fonds de commerce ou artisanal.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Redevance mensuelle de gérance (€) *</Label>
                              <Input
                                type="number"
                                value={redevanceGerance}
                                onChange={(e) => setRedevanceGerance(parseFloat(e.target.value) || 0)}
                                placeholder="Ex: 2000"
                              />
                              <p className="text-xs text-muted-foreground">
                                Montant fixe ou variable versé au propriétaire du fonds. Distinct du loyer des murs.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Récapitulatif */}
                      <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                        <p className="text-sm font-medium text-blue-900">
                          Total mensuel : {(loyer + charges).toLocaleString("fr-FR")} €
                          {isLocationGerance && redevanceGerance > 0 && (
                            <span className="ml-2 text-orange-700">
                              + redevance gérance : {redevanceGerance.toLocaleString("fr-FR")} €
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          {/* ✅ GAP-001 FIX: Adapter affichage 1er versement pour bail mobilité */}
                          {selectedType === "bail_mobilite" ? (
                            <>1er versement : {(loyer + charges).toLocaleString("fr-FR")} € (loyer + charges)</>
                          ) : (
                            <>1er versement : {(loyer + charges + depot).toLocaleString("fr-FR")} € (loyer + charges + dépôt)</>
                          )}
                        </p>
                        {indexationType && (
                          <p className="text-xs text-blue-600 mt-1">
                            Indexation : {indexationType === "ILC" ? "ILC (Loyers Commerciaux)" : indexationType === "ILAT" ? "ILAT (Activités Tertiaires)" : "IRL (Référence Loyers)"}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Étape 3 : SOTA Split View (Form + Preview) */}
            {currentStep === 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
                {/* Colonne Gauche : Formulaire (Scrollable) */}
                <div className="lg:col-span-5 overflow-y-auto pr-2">
                  <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
                    <div>
                      <h3 className="text-lg font-bold mb-1">Finalisation</h3>
                      <p className="text-sm text-muted-foreground">Complétez les informations du locataire</p>
                    </div>

                    {isColocation ? (
                      <div className="space-y-8">
                        <ColocationConfig property={selectedProperty || null} config={colocConfig} onConfigChange={setColocConfig} />
                        <MultiTenantInvite config={colocConfig} invitees={invitees} onInviteesChange={setInvitees} totalRent={loyer + charges} />
                      </div>
                    ) : (
                      <TenantInvite
                        tenantEmail={tenantEmail}
                        tenantName={tenantName}
                        onEmailChange={setTenantEmail}
                        onNameChange={setTenantName}
                        mode={creationMode}
                        onModeChange={setCreationMode}
                      />
                    )}

                    {/* Section Garant */}
                    <div className="pt-6 border-t">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase mb-4">Garantie</h4>
                      <GarantForm
                        garant={garant}
                        onGarantChange={setGarant}
                        hasGarant={hasGarant}
                        onHasGarantChange={setHasGarant}
                      />
                    </div>

                    {/* Rappel des conditions financières (éditable ici aussi pour le live preview) */}
                    <div className="pt-6 border-t">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase">Ajustements rapides</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Loyer</Label>
                          <Input type="number" className="h-8" value={loyer} onChange={(e) => setLoyer(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Charges</Label>
                          <Input type="number" className="h-8" value={charges} onChange={(e) => setCharges(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date début</Label>
                          <Input type="date" className="h-8" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                        </div>
                      </div>
                    </div>

                    {/* P2-6: Clauses personnalisables */}
                    <div className="pt-6 border-t">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase mb-4">Clauses additionnelles</h4>
                      <CustomClauses
                        typeBail={selectedType || ""}
                        value={customClauses}
                        onChange={setCustomClauses}
                      />
                    </div>
                  </div>
                </div>

                {/* Colonne Droite : Live Preview (Sticky) */}
                <div className="lg:col-span-7 bg-slate-100 rounded-xl border overflow-hidden flex flex-col h-full">
                  <div className="bg-slate-200 px-4 py-2 border-b flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      Aperçu en temps réel
                    </span>
                    <Badge variant="outline" className="bg-white">
                      {selectedType?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex-1 overflow-auto bg-slate-50 p-4">
                    <div className="scale-90 origin-top-left w-[110%] h-[110%]">
                      <LeasePreview typeBail={selectedType! as any} bailData={previewData as any} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Bar (Fixed Bottom) */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
          <div className="container mx-auto max-w-5xl flex justify-between items-center">
            <Button variant="outline" onClick={goBack} disabled={currentStep === 1} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>

            {currentStep < 3 ? (
              <motion.div
                animate={canProceed ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Button 
                  onClick={goNext} 
                  disabled={!canProceed} 
                  className={cn(
                    "gap-2 transition-all duration-300",
                    canProceed 
                      ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30" 
                      : "bg-slate-300"
                  )}
                >
                  Suivant <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed || isSubmitting}
                className={cn("gap-2 min-w-[200px]", creationMode === "invite" ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700")}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  creationMode === "invite" ? <><Send className="h-4 w-4" /> Finaliser et Envoyer</> : <><Printer className="h-4 w-4" /> Créer et Imprimer</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

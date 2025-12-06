"use client";
// @ts-nocheck

import { useState, useMemo, useCallback, useEffect } from "react";
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
  Eye,
  Calendar,
  Euro,
  Building2,
  Users,
  Sparkles,
  AlertCircle,
  Pencil,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

import { LeaseTypeCards, LEASE_TYPE_CONFIGS, type LeaseType } from "./LeaseTypeCards";
import { PropertySelector } from "./PropertySelector";
import { TenantInvite } from "./TenantInvite";
import { ColocationConfig, DEFAULT_COLOCATION_CONFIG, type ColocationConfigData } from "./ColocationConfig";
import { MultiTenantInvite, type Invitee } from "./MultiTenantInvite";

interface Property {
  id: string;
  adresse_complete?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type?: string;
  surface?: number;
  nb_pieces?: number;
  loyer_hc?: number;
  charges_forfaitaires?: number;
  dpe_classe?: string;
}

interface LeaseWizardProps {
  properties: Property[];
  initialPropertyId?: string;
}

// Étapes du wizard
const STEPS = [
  { id: 1, title: "Type de bail", icon: FileText },
  { id: 2, title: "Bien concerné", icon: Building2 },
  { id: 3, title: "Inviter locataire", icon: Users },
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

  // État du wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Données du formulaire
  const [selectedType, setSelectedType] = useState<LeaseType | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(initialPropertyId || null);
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");

  // Données financières (pré-remplies depuis le bien)
  const [loyer, setLoyer] = useState<number>(0);
  const [charges, setCharges] = useState<number>(0);
  const [depot, setDepot] = useState<number>(0);
  const [dateDebut, setDateDebut] = useState<string>(new Date().toISOString().split("T")[0]);
  
  // ✅ États pour la colocation
  const [colocConfig, setColocConfig] = useState<ColocationConfigData>(DEFAULT_COLOCATION_CONFIG);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  
  // Vérifier si c'est un bail colocation
  const isColocation = selectedType === "colocation";

  // Propriété sélectionnée
  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  );

  // Configuration du type de bail sélectionné
  const leaseConfig = selectedType ? LEASE_TYPE_CONFIGS[selectedType] : null;

  // Date de fin calculée
  const dateFin = useMemo(() => {
    if (!dateDebut || !leaseConfig) return null;
    return calculateEndDate(dateDebut, leaseConfig.durationMonths);
  }, [dateDebut, leaseConfig]);

  // Dépôt max légal
  const maxDepot = useMemo(() => {
    if (!leaseConfig || !loyer) return null;
    return loyer * leaseConfig.maxDepositMonths;
  }, [leaseConfig, loyer]);

  // ✅ Mapping type de bail → types de propriétés compatibles
  const PROPERTY_TYPES_BY_LEASE: Record<LeaseType, string[]> = {
    nu: ["appartement", "maison", "studio"],
    meuble: ["appartement", "maison", "studio", "colocation"],
    colocation: ["appartement", "maison", "colocation"],
    saisonnier: ["appartement", "maison", "studio", "saisonnier"],
    bail_mobilite: ["appartement", "maison", "studio"],
    contrat_parking: ["parking", "box"],
    commercial_3_6_9: ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"],
    professionnel: ["bureaux", "local_commercial"],
  };

  // ✅ Filtrer les propriétés selon le type de bail sélectionné
  const filteredProperties = useMemo(() => {
    if (!selectedType) return properties;
    const allowedTypes = PROPERTY_TYPES_BY_LEASE[selectedType];
    return properties.filter((p) => allowedTypes.includes(p.type || ""));
  }, [properties, selectedType]);

  // Gestion de la sélection de propriété
  const handlePropertySelect = useCallback((property: Property) => {
    setSelectedPropertyId(property.id);
    // Pré-remplir les données financières
    if (property.loyer_hc) setLoyer(property.loyer_hc);
    if (property.charges_forfaitaires) setCharges(property.charges_forfaitaires);
    // Dépôt = 1 ou 2 mois selon le type de bail
    const depotMonths = selectedType ? LEASE_TYPE_CONFIGS[selectedType].maxDepositMonths : 1;
    if (property.loyer_hc) setDepot(property.loyer_hc * depotMonths);
  }, [selectedType]);

  // ✅ Pré-remplissage automatique si un logement est fourni via l'URL
  useEffect(() => {
    if (initialPropertyId && properties.length > 0 && loyer === 0) {
      const property = properties.find(p => p.id === initialPropertyId);
      if (property) {
        // Pré-remplir les données financières
        if (property.loyer_hc) setLoyer(property.loyer_hc);
        if (property.charges_forfaitaires) setCharges(property.charges_forfaitaires);
        // Dépôt par défaut = 1 mois (sera ajusté quand le type de bail est choisi)
        if (property.loyer_hc) setDepot(property.loyer_hc);
      }
    }
  }, [initialPropertyId, properties, loyer]);

  // Gestion du changement de type de bail
  const handleTypeSelect = useCallback((type: LeaseType) => {
    setSelectedType(type);
    // Mettre à jour le dépôt si loyer déjà renseigné
    if (loyer > 0) {
      setDepot(loyer * LEASE_TYPE_CONFIGS[type].maxDepositMonths);
    }
  }, [loyer]);

  // Validation de l'étape courante
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return selectedType !== null;
      case 2:
        return selectedPropertyId !== null && loyer > 0;
      case 3:
        // Validation différente pour colocation vs bail standard
        if (isColocation) {
          const validInvitees = invitees.filter(i => 
            i.email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email)
          );
          return validInvitees.length > 0; // Au moins 1 colocataire valide
        }
        return tenantEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantEmail);
      default:
        return false;
    }
  }, [currentStep, selectedType, selectedPropertyId, loyer, tenantEmail, isColocation, invitees]);

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
        toast({
          title: "Données manquantes",
          description: "Veuillez sélectionner un bien et inviter au moins un colocataire",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!selectedType || !selectedPropertyId || !tenantEmail) {
        toast({
          title: "Données manquantes",
          description: "Veuillez remplir tous les champs obligatoires",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Préparer les données de colocation si applicable
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

      // Créer le bail et envoyer l'invitation
      const response = await fetch("/api/leases/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedPropertyId,
          type_bail: selectedType,
          loyer,
          charges_forfaitaires: charges,
          depot_garantie: depot,
          date_debut: dateDebut,
          date_fin: dateFin,
          // Données standard ou colocation
          ...(isColocation ? colocData : {
            tenant_email: tenantEmail,
            tenant_name: tenantName || null,
          }),
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error("API Error:", result);
        throw new Error(result.error || result.details || result.hint || "Erreur lors de la création");
      }

      toast({
        title: "✅ Invitation envoyée !",
        description: `Un email a été envoyé à ${tenantEmail} pour compléter et signer le bail.`,
      });

      // Rediriger vers la page du bail
      router.push(`/app/owner/contracts/${result.lease_id}`);
    } catch (error: any) {
      console.error("Erreur création bail:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 hover:bg-transparent">
            <Link href="/app/owner/contracts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux baux
            </Link>
          </Button>
          
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
                Nouveau bail
              </h1>
              <p className="text-muted-foreground">
                Créez un contrat en 3 étapes simples
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  {/* Step circle */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        backgroundColor: isCompleted
                          ? "rgb(34 197 94)"
                          : isActive
                          ? "rgb(59 130 246)"
                          : "rgb(226 232 240)",
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        isActive || isCompleted ? "text-white" : "text-slate-500"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </motion.div>
                    <span className={cn(
                      "text-xs mt-2 font-medium",
                      isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </div>
                  
                  {/* Connector */}
                  {index < STEPS.length - 1 && (
                    <div className="flex-1 mx-4 h-0.5 bg-slate-200 dark:bg-slate-700">
                      <motion.div
                        initial={false}
                        animate={{ width: currentStep > step.id ? "100%" : "0%" }}
                        className="h-full bg-green-500"
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-6 md:p-8">
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
                <LeaseTypeCards
                  selectedType={selectedType}
                  onSelect={handleTypeSelect}
                  propertyType={selectedProperty?.type}
                />
              )}

              {/* Étape 2 : Sélection du bien */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  {/* Si logement pré-sélectionné via URL, afficher en mode confirmé */}
                  {initialPropertyId && selectedProperty ? (
                    <div className="space-y-4">
                      {/* Logement confirmé */}
                      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                              <Building2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Logement sélectionné</p>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {selectedProperty.adresse_complete || selectedProperty.adresse}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            <Check className="h-3 w-3 mr-1" />
                            Confirmé
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>{selectedProperty.code_postal} {selectedProperty.ville}</span>
                          {selectedProperty.surface && <span>• {selectedProperty.surface} m²</span>}
                          {selectedProperty.nb_pieces && <span>• {selectedProperty.nb_pieces} pièces</span>}
                          {selectedProperty.type && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {selectedProperty.type}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Option changer de logement */}
                      <details className="group">
                        <summary className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                          <RefreshCw className="h-4 w-4" />
                          Changer de logement
                        </summary>
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <PropertySelector
                            properties={filteredProperties}
                            selectedPropertyId={selectedPropertyId}
                            onSelect={handlePropertySelect}
                          />
                        </div>
                      </details>
                    </div>
                  ) : (
                    /* Sélecteur normal si pas de pré-sélection */
                    <PropertySelector
                      properties={filteredProperties}
                      selectedPropertyId={selectedPropertyId}
                      onSelect={handlePropertySelect}
                    />
                  )}

                  {/* Données financières (éditable) */}
                  {selectedPropertyId && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/50"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            <Euro className="h-4 w-4 text-amber-600" />
                            Conditions financières
                          </h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Info className="h-3 w-3" />
                            Pré-remplies depuis le logement — ajustez si besoin
                          </p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 gap-1">
                          <Pencil className="h-3 w-3" />
                          Modifiable
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="loyer" className="flex items-center gap-1">
                            Loyer mensuel (€) *
                            <Pencil className="h-3 w-3 text-amber-500" />
                          </Label>
                          <Input
                            id="loyer"
                            type="number"
                            min="0"
                            value={loyer || ""}
                            onChange={(e) => setLoyer(parseFloat(e.target.value) || 0)}
                            className="bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 focus:ring-amber-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="charges" className="flex items-center gap-1">
                            Charges (€/mois)
                            <Pencil className="h-3 w-3 text-amber-500" />
                          </Label>
                          <Input
                            id="charges"
                            type="number"
                            min="0"
                            value={charges || ""}
                            onChange={(e) => setCharges(parseFloat(e.target.value) || 0)}
                            className="bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 focus:ring-amber-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="depot" className="flex items-center gap-1">
                            Dépôt garantie (€)
                            <Pencil className="h-3 w-3 text-amber-500" />
                            {maxDepot !== null && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                max: {formatCurrency(maxDepot)}
                              </span>
                            )}
                          </Label>
                          <Input
                            id="depot"
                            type="number"
                            min="0"
                            value={depot || ""}
                            onChange={(e) => setDepot(parseFloat(e.target.value) || 0)}
                            className={cn(
                              "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 focus:ring-amber-500",
                              maxDepot && depot > maxDepot && "border-orange-500"
                            )}
                          />
                          {maxDepot && depot > maxDepot && (
                            <p className="text-[10px] text-orange-500 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Dépasse le max légal
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date_debut">Date de début *</Label>
                          <Input
                            id="date_debut"
                            type="date"
                            value={dateDebut}
                            onChange={(e) => setDateDebut(e.target.value)}
                            className="bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      {/* Résumé */}
                      {loyer > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-800/50">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Total mensuel</p>
                                <p className="text-lg font-bold text-primary">
                                  {formatCurrency(loyer + charges)}/mois
                                </p>
                              </div>
                              {dateFin && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Fin du bail</p>
                                  <p className="text-sm font-medium flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDateShort(dateFin)}
                                  </p>
                                </div>
                              )}
                            </div>
                            {leaseConfig && (
                              <Badge variant="secondary" className="gap-1">
                                <Sparkles className="h-3 w-3" />
                                {leaseConfig.name} - {leaseConfig.durationMonths} mois
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Étape 3 : Invitation locataire */}
              {currentStep === 3 && (
                isColocation ? (
                  <div className="space-y-8">
                    {/* Configuration colocation */}
                    <ColocationConfig
                      property={selectedProperty || null}
                      config={colocConfig}
                      onConfigChange={setColocConfig}
                    />
                    
                    {/* Invitations multiples */}
                    <MultiTenantInvite
                      config={colocConfig}
                      invitees={invitees}
                      onInviteesChange={setInvitees}
                      totalRent={loyer + charges}
                    />
                  </div>
                ) : (
                  <TenantInvite
                    tenantEmail={tenantEmail}
                    tenantName={tenantName}
                    onEmailChange={setTenantEmail}
                    onNameChange={setTenantName}
                  />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Précédent
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === 3 && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  // TODO: Ouvrir l'aperçu du bail
                  toast({
                    title: "Aperçu",
                    description: "L'aperçu sera disponible après envoi de l'invitation",
                  });
                }}
              >
                <Eye className="h-4 w-4" />
                Aperçu
              </Button>
            )}

            {currentStep < 3 ? (
              <Button
                onClick={goNext}
                disabled={!canProceed}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Suivant
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed || isSubmitting}
                className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 min-w-[180px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Envoyer l'invitation
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


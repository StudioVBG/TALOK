"use client";

/**
 * Wizard de création de bail parking - UI/UX SOTA 2025
 * 
 * Caractéristiques :
 * - Wizard multi-étapes avec animations fluides
 * - Génération automatique des conditions selon le type
 * - Preview en temps réel du contrat
 * - Design glassmorphism moderne
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Car, Lock, Zap, Shield, FileText, ChevronRight, ChevronLeft,
  Check, Sparkles, MapPin, Calendar, Euro, User, Building,
  Key, Camera, Gauge, Info, AlertTriangle, Download, Eye
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import {
  PARKING_PRESETS,
  type ParkingCategory,
  type VehicleType,
  type AccessMethod,
  type SecurityFeature,
  type ParkingLease,
  type ParkingLeaseConditions,
  type ParkingSpecifications,
  getParkingPreset,
  getAccessMethodLabel,
  getSecurityFeatureLabel,
  getParkingCategoryLabel,
  getVehicleTypeLabel,
} from "@/lib/templates/bail/bail-parking.types";

// ============================================
// TYPES
// ============================================

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface ParkingLeaseWizardProps {
  propertyId?: string;
  onComplete: (lease: Partial<ParkingLease>) => void;
  onCancel: () => void;
}

// ============================================
// CONSTANTES
// ============================================

const STEPS: WizardStep[] = [
  { 
    id: "type", 
    title: "Type de parking", 
    description: "Sélectionnez le type d'emplacement",
    icon: <Car className="h-5 w-5" /> 
  },
  { 
    id: "details", 
    title: "Caractéristiques", 
    description: "Décrivez l'emplacement",
    icon: <Info className="h-5 w-5" /> 
  },
  { 
    id: "conditions", 
    title: "Conditions", 
    description: "Durée et modalités",
    icon: <FileText className="h-5 w-5" /> 
  },
  { 
    id: "financial", 
    title: "Loyer", 
    description: "Conditions financières",
    icon: <Euro className="h-5 w-5" /> 
  },
  { 
    id: "parties", 
    title: "Parties", 
    description: "Bailleur et locataire",
    icon: <User className="h-5 w-5" /> 
  },
  { 
    id: "preview", 
    title: "Récapitulatif", 
    description: "Vérifiez et validez",
    icon: <Eye className="h-5 w-5" /> 
  },
];

const VEHICLE_TYPES: { value: VehicleType; label: string; icon: string }[] = [
  { value: "voiture_citadine", label: "Citadine", icon: "🚗" },
  { value: "voiture_berline", label: "Berline", icon: "🚙" },
  { value: "voiture_suv", label: "SUV / 4x4", icon: "🚐" },
  { value: "utilitaire_leger", label: "Utilitaire", icon: "🚚" },
  { value: "camping_car", label: "Camping-car", icon: "🏕️" },
  { value: "moto", label: "Moto", icon: "🏍️" },
  { value: "scooter", label: "Scooter", icon: "🛵" },
  { value: "velo", label: "Vélo", icon: "🚲" },
  { value: "velo_electrique", label: "Vélo électrique", icon: "⚡" },
];

const ACCESS_METHODS: { value: AccessMethod; label: string; icon: string }[] = [
  { value: "badge_rfid", label: "Badge RFID", icon: "🪪" },
  { value: "telecommande", label: "Télécommande", icon: "📡" },
  { value: "cle_physique", label: "Clé", icon: "🔑" },
  { value: "digicode", label: "Digicode", icon: "🔢" },
  { value: "plaque_immatriculation", label: "Reconnaissance plaque", icon: "📷" },
  { value: "acces_libre", label: "Accès libre", icon: "🚪" },
];

const SECURITY_FEATURES: { value: SecurityFeature; label: string; icon: string }[] = [
  { value: "barriere_automatique", label: "Barrière automatique", icon: "🚧" },
  { value: "portail_securise", label: "Portail sécurisé", icon: "🚪" },
  { value: "video_surveillance", label: "Vidéosurveillance", icon: "📹" },
  { value: "gardiennage_24h", label: "Gardiennage 24h", icon: "👮" },
  { value: "eclairage_permanent", label: "Éclairage", icon: "💡" },
  { value: "alarme_intrusion", label: "Alarme", icon: "🚨" },
  { value: "interphone", label: "Interphone", icon: "📞" },
  { value: "residence_fermee", label: "Résidence fermée", icon: "🏠" },
];

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function ParkingLeaseWizard({ propertyId, onComplete, onCancel }: ParkingLeaseWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // État du formulaire
  const [formData, setFormData] = useState<{
    category: ParkingCategory | null;
    vehicleType: VehicleType;
    specifications: Partial<ParkingSpecifications>;
    conditions: Partial<ParkingLeaseConditions>;
    owner: Record<string, any>;
    tenant: Record<string, any>;
    specialClauses: string[];
  }>({
    category: null,
    vehicleType: "voiture_berline",
    specifications: {
      features: {
        couvert: false,
        ferme: false,
        eclaire: true,
        prise_electrique: false,
        borne_recharge_ve: false,
        eau_disponible: false,
        local_rangement: false,
      },
      access: [],
      security: [],
      location: {},
    },
    conditions: {
      locationType: "independant",
      duration: { type: "indeterminee", startDate: new Date().toISOString().split("T")[0] },
      noticePeriod: { landlordMonths: 1, tenantMonths: 1 },
      financial: {
        rentMonthly: 80,
        rentIncludesVAT: false,
        chargesMonthly: 0,
        chargesType: "incluses",
        deposit: 80,
        depositMonths: 1,
      },
      payment: { method: "virement", dayOfMonth: 5, inAdvance: true },
      rentRevision: { allowed: true, index: "IRL" },
      insurance: { tenantRequired: true, vehicleInsuranceRequired: true, responsabiliteCivile: true },
      usage: {
        allowedVehicles: ["voiture_berline"],
        storageAllowed: false,
        workshopForbidden: true,
        commercialUseForbidden: true,
        sublettingAllowed: false,
      },
    },
    owner: { type: "particulier" },
    tenant: { type: "particulier" },
    specialClauses: [],
  });

  // Handlers
  const updateFormData = useCallback(<K extends keyof typeof formData>(
    key: K, 
    value: typeof formData[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleCategorySelect = useCallback((category: ParkingCategory) => {
    const preset = getParkingPreset(category);
    if (preset) {
      setFormData(prev => ({
        ...prev,
        category,
        specifications: {
          ...prev.specifications,
          category,
          features: { ...prev.specifications.features, ...preset.commonFeatures },
          security: preset.commonSecurity,
        },
        conditions: {
          ...prev.conditions,
          ...preset.defaultConditions,
          financial: {
            ...prev.conditions.financial,
            ...preset.defaultConditions?.financial,
            rentMonthly: preset.suggestedRent.min + 
              Math.round((preset.suggestedRent.max - preset.suggestedRent.min) / 2),
          },
        },
      }));
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Simuler la génération
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const lease: Partial<ParkingLease> = {
        reference: `PARK-${Date.now()}`,
        status: "draft",
        parking: {
          propertyId,
          address: formData.owner.address || "",
          postalCode: formData.owner.postalCode || "",
          city: formData.owner.city || "",
          specifications: formData.specifications as ParkingSpecifications,
        },
        conditions: formData.conditions as ParkingLeaseConditions,
        owner: formData.owner,
        tenant: formData.tenant,
        specialClauses: formData.specialClauses,
      };

      toast({
        title: "Contrat généré avec succès ! 🎉",
        description: "Votre contrat de location de parking est prêt.",
      });

      onComplete(lease);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le contrat.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [formData, propertyId, onComplete, toast]);

  // Calculer la progression
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  // Vérifier si l'étape courante est valide
  const isCurrentStepValid = useMemo(() => {
    switch (currentStep) {
      case 0: return formData.category !== null;
      case 1: return formData.specifications.location?.numero;
      case 2: return formData.conditions.duration?.startDate;
      case 3: return (formData.conditions.financial?.rentMonthly ?? 0) > 0;
      case 4: return formData.owner.firstName && formData.tenant.firstName;
      default: return true;
    }
  }, [currentStep, formData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      {/* Header avec progression */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Car className="h-6 w-6 text-white" />
              </div>
              Bail de Parking
            </h1>
            <p className="text-slate-400 mt-1">
              Créez votre contrat en quelques étapes
            </p>
          </div>
          
          <Button variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white">
            Annuler
          </Button>
        </div>

        {/* Barre de progression */}
        <div className="relative">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          
          {/* Steps indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step, index) => (
              <motion.button
                key={step.id}
                onClick={() => index <= currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={cn(
                  "flex flex-col items-center gap-2 transition-all",
                  index <= currentStep ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                )}
                whileHover={index <= currentStep ? { scale: 1.05 } : {}}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  index < currentStep 
                    ? "bg-green-500 text-white" 
                    : index === currentStep
                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-purple-500/30"
                    : "bg-slate-700 text-slate-400"
                )}>
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden md:block",
                  index === currentStep ? "text-white" : "text-slate-500"
                )}>
                  {step.title}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Contenu principal */}
      <div className="max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && (
              <StepParkingType 
                selected={formData.category}
                onSelect={handleCategorySelect}
              />
            )}
            
            {currentStep === 1 && formData.category && (
              <StepDetails
                category={formData.category}
                vehicleType={formData.vehicleType}
                specifications={formData.specifications}
                onUpdate={(specs) => updateFormData("specifications", specs)}
                onVehicleTypeChange={(type) => updateFormData("vehicleType", type)}
              />
            )}
            
            {currentStep === 2 && (
              <StepConditions
                conditions={formData.conditions}
                onUpdate={(cond) => updateFormData("conditions", cond)}
              />
            )}
            
            {currentStep === 3 && formData.category && (
              <StepFinancial
                category={formData.category}
                conditions={formData.conditions}
                onUpdate={(cond) => updateFormData("conditions", cond)}
              />
            )}
            
            {currentStep === 4 && (
              <StepParties
                owner={formData.owner}
                tenant={formData.tenant}
                onOwnerUpdate={(owner) => updateFormData("owner", owner)}
                onTenantUpdate={(tenant) => updateFormData("tenant", tenant)}
              />
            )}
            
            {currentStep === 5 && (
              <StepPreview
                formData={formData}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <motion.div 
          className="flex justify-between mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Précédent
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={nextStep}
              disabled={!isCurrentStepValid}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                  </motion.div>
                  Génération...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Générer le contrat
                </>
              )}
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ============================================
// ÉTAPE 1 : TYPE DE PARKING
// ============================================

function StepParkingType({ 
  selected, 
  onSelect 
}: { 
  selected: ParkingCategory | null;
  onSelect: (cat: ParkingCategory) => void;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          Quel type de parking souhaitez-vous louer ?
        </CardTitle>
        <CardDescription className="text-slate-400">
          Sélectionnez le type correspondant à votre emplacement. Les conditions seront adaptées automatiquement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PARKING_PRESETS.map((preset) => (
            <motion.button
              key={preset.category}
              onClick={() => onSelect(preset.category)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "p-6 rounded-2xl border-2 text-left transition-all relative overflow-hidden group",
                selected === preset.category
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
              )}
            >
              {/* Effet de brillance */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>

              <div className="flex items-start gap-4">
                <div className={cn(
                  "text-4xl p-3 rounded-xl",
                  selected === preset.category
                    ? "bg-blue-500/20"
                    : "bg-slate-600/50"
                )}>
                  {preset.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white text-lg">
                    {preset.label}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {preset.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="bg-slate-600">
                      {preset.suggestedRent.min}€ - {preset.suggestedRent.max}€/mois
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Indicateur de sélection */}
              {selected === preset.category && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3"
                >
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// ÉTAPE 2 : CARACTÉRISTIQUES
// ============================================

function StepDetails({
  category,
  vehicleType,
  specifications,
  onUpdate,
  onVehicleTypeChange,
}: {
  category: ParkingCategory;
  vehicleType: VehicleType;
  specifications: Partial<ParkingSpecifications>;
  onUpdate: (specs: Partial<ParkingSpecifications>) => void;
  onVehicleTypeChange: (type: VehicleType) => void;
}) {
  const preset = getParkingPreset(category);

  return (
    <div className="space-y-6">
      {/* Localisation */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Localisation
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-slate-300">Numéro d'emplacement *</Label>
            <Input
              placeholder="Ex: 42, A-15..."
              value={specifications.location?.numero || ""}
              onChange={(e) => onUpdate({
                ...specifications,
                location: { ...specifications.location, numero: e.target.value }
              })}
              className="bg-slate-700 border-slate-600 text-white mt-2"
            />
          </div>
          <div>
            <Label className="text-slate-300">Niveau / Étage</Label>
            <Input
              placeholder="Ex: -1, RDC, +2..."
              value={specifications.location?.niveau || ""}
              onChange={(e) => onUpdate({
                ...specifications,
                location: { ...specifications.location, niveau: e.target.value }
              })}
              className="bg-slate-700 border-slate-600 text-white mt-2"
            />
          </div>
          <div>
            <Label className="text-slate-300">Zone / Bâtiment</Label>
            <Input
              placeholder="Ex: Zone A, Bât. B..."
              value={specifications.location?.zone || ""}
              onChange={(e) => onUpdate({
                ...specifications,
                location: { ...specifications.location, zone: e.target.value }
              })}
              className="bg-slate-700 border-slate-600 text-white mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Type de véhicule */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Car className="h-5 w-5 text-purple-400" />
            Type de véhicule autorisé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {VEHICLE_TYPES.map((v) => (
              <motion.button
                key={v.value}
                onClick={() => onVehicleTypeChange(v.value)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                  vehicleType === v.value
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                )}
              >
                <span className="text-2xl">{v.icon}</span>
                <span className="text-sm text-slate-300">{v.label}</span>
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Équipements */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Équipements & Caractéristiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: "couvert", label: "Couvert", icon: "☔", recommended: preset?.commonFeatures?.couvert },
              { key: "ferme", label: "Fermé (box)", icon: "🔒", recommended: preset?.commonFeatures?.ferme },
              { key: "eclaire", label: "Éclairé", icon: "💡", recommended: true },
              { key: "prise_electrique", label: "Prise électrique", icon: "🔌" },
              { key: "borne_recharge_ve", label: "Borne VE", icon: "⚡" },
              { key: "eau_disponible", label: "Point d'eau", icon: "💧" },
              { key: "local_rangement", label: "Rangement", icon: "📦" },
            ].map((feature) => (
              <div
                key={feature.key}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                  specifications.features?.[feature.key as keyof typeof specifications.features]
                    ? "border-green-500 bg-green-500/10"
                    : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                )}
                onClick={() => onUpdate({
                  ...specifications,
                  features: {
                    ...specifications.features,
                    [feature.key]: !specifications.features?.[feature.key as keyof typeof specifications.features],
                  },
                })}
              >
                <span className="text-xl">{feature.icon}</span>
                <div className="flex-1">
                  <span className="text-sm text-slate-300">{feature.label}</span>
                  {feature.recommended && (
                    <Badge variant="outline" className="ml-2 text-xs border-blue-500 text-blue-400">
                      Suggéré
                    </Badge>
                  )}
                </div>
                <Checkbox
                  checked={!!specifications.features?.[feature.key as keyof typeof specifications.features]}
                  className="border-slate-500"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accès et Sécurité */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-400" />
              Moyens d'accès
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ACCESS_METHODS.map((access) => (
              <div
                key={access.value}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  specifications.access?.includes(access.value)
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-600 hover:border-slate-500"
                )}
                onClick={() => {
                  const current = specifications.access || [];
                  const newAccess = current.includes(access.value)
                    ? current.filter((a) => a !== access.value)
                    : [...current, access.value];
                  onUpdate({ ...specifications, access: newAccess });
                }}
              >
                <span className="text-lg">{access.icon}</span>
                <span className="flex-1 text-slate-300">{access.label}</span>
                <Checkbox
                  checked={specifications.access?.includes(access.value)}
                  className="border-slate-500"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-400" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SECURITY_FEATURES.map((security) => (
              <div
                key={security.value}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  specifications.security?.includes(security.value)
                    ? "border-green-500 bg-green-500/10"
                    : "border-slate-600 hover:border-slate-500"
                )}
                onClick={() => {
                  const current = specifications.security || [];
                  const newSecurity = current.includes(security.value)
                    ? current.filter((s) => s !== security.value)
                    : [...current, security.value];
                  onUpdate({ ...specifications, security: newSecurity });
                }}
              >
                <span className="text-lg">{security.icon}</span>
                <span className="flex-1 text-slate-300">{security.label}</span>
                <Checkbox
                  checked={specifications.security?.includes(security.value)}
                  className="border-slate-500"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// ÉTAPE 3 : CONDITIONS
// ============================================

function StepConditions({
  conditions,
  onUpdate,
}: {
  conditions: Partial<ParkingLeaseConditions>;
  onUpdate: (cond: Partial<ParkingLeaseConditions>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Type de location */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-400" />
            Type de location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={conditions.locationType || "independant"}
            onValueChange={(v) => onUpdate({ 
              ...conditions, 
              locationType: v as "independant" | "accessoire_logement" 
            })}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Label
              htmlFor="independant"
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                conditions.locationType === "independant"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="independant" id="independant" />
              <div>
                <span className="font-medium text-white">Location indépendante</span>
                <p className="text-sm text-slate-400 mt-1">
                  Le parking est loué séparément, sans lien avec un logement
                </p>
              </div>
            </Label>
            <Label
              htmlFor="accessoire"
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                conditions.locationType === "accessoire_logement"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="accessoire_logement" id="accessoire" />
              <div>
                <span className="font-medium text-white">Accessoire à un logement</span>
                <p className="text-sm text-slate-400 mt-1">
                  Loué en complément d'un logement (même bailleur/locataire)
                </p>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Durée */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            Durée du contrat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={conditions.duration?.type || "indeterminee"}
            onValueChange={(v) => onUpdate({
              ...conditions,
              duration: { 
                ...conditions.duration, 
                type: v as "indeterminee" | "determinee",
                startDate: conditions.duration?.startDate || new Date().toISOString().split("T")[0],
              },
            })}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="indeterminee"
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                conditions.duration?.type === "indeterminee"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="indeterminee" id="indeterminee" />
              <span className="text-white">Durée indéterminée</span>
            </Label>
            <Label
              htmlFor="determinee"
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                conditions.duration?.type === "determinee"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="determinee" id="determinee" />
              <span className="text-white">Durée déterminée</span>
            </Label>
          </RadioGroup>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Date de début *</Label>
              <Input
                type="date"
                value={conditions.duration?.startDate || ""}
                onChange={(e) => onUpdate({
                  ...conditions,
                  duration: { ...conditions.duration, startDate: e.target.value },
                })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
            {conditions.duration?.type === "determinee" && (
              <div>
                <Label className="text-slate-300">Durée (mois)</Label>
                <Input
                  type="number"
                  min="1"
                  value={conditions.duration?.months || 12}
                  onChange={(e) => onUpdate({
                    ...conditions,
                    duration: { ...conditions.duration, months: parseInt(e.target.value) },
                  })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Préavis */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Préavis de résiliation
          </CardTitle>
          <CardDescription className="text-slate-400">
            Délai minimum légal : 1 mois pour les deux parties
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-slate-300">Préavis du bailleur (mois)</Label>
            <div className="flex items-center gap-4 mt-3">
              <Slider
                value={[conditions.noticePeriod?.landlordMonths || 1]}
                onValueChange={([v]) => onUpdate({
                  ...conditions,
                  noticePeriod: { ...conditions.noticePeriod, landlordMonths: v, tenantMonths: conditions.noticePeriod?.tenantMonths || 1 },
                })}
                min={1}
                max={6}
                step={1}
                className="flex-1"
              />
              <Badge variant="secondary" className="min-w-[3rem] justify-center">
                {conditions.noticePeriod?.landlordMonths || 1} mois
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Préavis du locataire (mois)</Label>
            <div className="flex items-center gap-4 mt-3">
              <Slider
                value={[conditions.noticePeriod?.tenantMonths || 1]}
                onValueChange={([v]) => onUpdate({
                  ...conditions,
                  noticePeriod: { ...conditions.noticePeriod, tenantMonths: v, landlordMonths: conditions.noticePeriod?.landlordMonths || 1 },
                })}
                min={1}
                max={3}
                step={1}
                className="flex-1"
              />
              <Badge variant="secondary" className="min-w-[3rem] justify-center">
                {conditions.noticePeriod?.tenantMonths || 1} mois
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// ÉTAPE 4 : CONDITIONS FINANCIÈRES
// ============================================

function StepFinancial({
  category,
  conditions,
  onUpdate,
}: {
  category: ParkingCategory;
  conditions: Partial<ParkingLeaseConditions>;
  onUpdate: (cond: Partial<ParkingLeaseConditions>) => void;
}) {
  const preset = getParkingPreset(category);
  const financial = conditions.financial || {};

  const totalMonthly = (financial.rentMonthly || 0) + (financial.chargesMonthly || 0);

  return (
    <div className="space-y-6">
      {/* Estimation du marché */}
      {preset && (
        <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-700/50 backdrop-blur-xl">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-3 rounded-full bg-blue-500/20">
              <Gauge className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-blue-300 text-sm">Estimation de marché pour un {getParkingCategoryLabel(category)}</p>
              <p className="text-2xl font-bold text-white">
                {preset.suggestedRent.min}€ - {preset.suggestedRent.max}€ <span className="text-base font-normal text-slate-400">/mois</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loyer */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Euro className="h-5 w-5 text-green-400" />
            Loyer mensuel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-slate-300">Montant du loyer</Label>
              <span className="text-2xl font-bold text-white">{financial.rentMonthly || 0} €</span>
            </div>
            <Slider
              value={[financial.rentMonthly || 0]}
              onValueChange={([v]) => onUpdate({
                ...conditions,
                financial: { 
                  ...financial, 
                  rentMonthly: v,
                  deposit: v,
                  depositMonths: 1,
                },
              })}
              min={0}
              max={500}
              step={5}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0 €</span>
              <span>500 €</span>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          <div>
            <Label className="text-slate-300">Charges</Label>
            <RadioGroup
              value={financial.chargesType || "incluses"}
              onValueChange={(v) => onUpdate({
                ...conditions,
                financial: { ...financial, chargesType: v as any },
              })}
              className="grid grid-cols-3 gap-3 mt-3"
            >
              {[
                { value: "incluses", label: "Incluses" },
                { value: "forfait", label: "Forfait" },
                { value: "provisions", label: "Provisions" },
              ].map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`charges-${opt.value}`}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-sm",
                    financial.chargesType === opt.value
                      ? "border-green-500 bg-green-500/10 text-white"
                      : "border-slate-600 hover:border-slate-500 text-slate-400"
                  )}
                >
                  <RadioGroupItem value={opt.value} id={`charges-${opt.value}`} className="sr-only" />
                  {opt.label}
                </Label>
              ))}
            </RadioGroup>
            
            {financial.chargesType !== "incluses" && (
              <div className="mt-4">
                <Label className="text-slate-300">Montant des charges</Label>
                <Input
                  type="number"
                  min="0"
                  value={financial.chargesMonthly || 0}
                  onChange={(e) => onUpdate({
                    ...conditions,
                    financial: { ...financial, chargesMonthly: parseFloat(e.target.value) || 0 },
                  })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
            )}
          </div>

          {/* Total */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/30">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Total mensuel</span>
              <span className="text-3xl font-bold text-green-400">{totalMonthly} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dépôt de garantie */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-400" />
            Dépôt de garantie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                value={financial.deposit || 0}
                onChange={(e) => onUpdate({
                  ...conditions,
                  financial: { 
                    ...financial, 
                    deposit: parseFloat(e.target.value) || 0,
                    depositMonths: (parseFloat(e.target.value) || 0) / (financial.rentMonthly || 1),
                  },
                })}
                className="bg-slate-700 border-slate-600 text-white text-lg"
              />
            </div>
            <span className="text-slate-400">€</span>
            <Badge variant="secondary" className="text-sm">
              ≈ {((financial.deposit || 0) / (financial.rentMonthly || 1)).toFixed(1)} mois
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            💡 Recommandé : 1 mois de loyer (soit {financial.rentMonthly || 0} €)
          </p>
        </CardContent>
      </Card>

      {/* Options */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white">Options de paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white">Révision annuelle du loyer</Label>
              <p className="text-sm text-slate-400">Indexation sur l'IRL</p>
            </div>
            <Switch
              checked={conditions.rentRevision?.allowed}
              onCheckedChange={(checked) => onUpdate({
                ...conditions,
                rentRevision: { ...conditions.rentRevision, allowed: checked, index: "IRL" },
              })}
            />
          </div>
          
          <Separator className="bg-slate-700" />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Jour de paiement</Label>
              <Input
                type="number"
                min="1"
                max="28"
                value={conditions.payment?.dayOfMonth || 5}
                onChange={(e) => onUpdate({
                  ...conditions,
                  payment: { ...conditions.payment, dayOfMonth: parseInt(e.target.value) || 5, method: conditions.payment?.method || "virement", inAdvance: conditions.payment?.inAdvance ?? true },
                })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-300">Mode de paiement</Label>
              <select
                value={conditions.payment?.method || "virement"}
                onChange={(e) => onUpdate({
                  ...conditions,
                  payment: { ...conditions.payment, method: e.target.value as any, dayOfMonth: conditions.payment?.dayOfMonth || 5, inAdvance: conditions.payment?.inAdvance ?? true },
                })}
                className="w-full h-10 mt-2 px-3 rounded-md bg-slate-700 border border-slate-600 text-white"
              >
                <option value="virement">Virement bancaire</option>
                <option value="prelevement">Prélèvement</option>
                <option value="cheque">Chèque</option>
                <option value="especes">Espèces</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// ÉTAPE 5 : PARTIES
// ============================================

function StepParties({
  owner,
  tenant,
  onOwnerUpdate,
  onTenantUpdate,
}: {
  owner: Record<string, any>;
  tenant: Record<string, any>;
  onOwnerUpdate: (owner: Record<string, any>) => void;
  onTenantUpdate: (tenant: Record<string, any>) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bailleur */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-400" />
            Le Bailleur
          </CardTitle>
          <CardDescription className="text-slate-400">
            Propriétaire du parking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={owner.type || "particulier"}
            onValueChange={(v) => onOwnerUpdate({ ...owner, type: v })}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="owner-particulier"
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                owner.type === "particulier"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="particulier" id="owner-particulier" />
              <span className="text-white">Particulier</span>
            </Label>
            <Label
              htmlFor="owner-societe"
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                owner.type === "societe"
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="societe" id="owner-societe" />
              <span className="text-white">Société</span>
            </Label>
          </RadioGroup>

          {owner.type === "particulier" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Prénom *</Label>
                <Input
                  value={owner.firstName || ""}
                  onChange={(e) => onOwnerUpdate({ ...owner, firstName: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
              <div>
                <Label className="text-slate-300">Nom *</Label>
                <Input
                  value={owner.lastName || ""}
                  onChange={(e) => onOwnerUpdate({ ...owner, lastName: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Raison sociale *</Label>
                <Input
                  value={owner.companyName || ""}
                  onChange={(e) => onOwnerUpdate({ ...owner, companyName: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
              <div>
                <Label className="text-slate-300">SIRET</Label>
                <Input
                  value={owner.siret || ""}
                  onChange={(e) => onOwnerUpdate({ ...owner, siret: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-slate-300">Adresse *</Label>
            <Input
              value={owner.address || ""}
              onChange={(e) => onOwnerUpdate({ ...owner, address: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white mt-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Code postal *</Label>
              <Input
                value={owner.postalCode || ""}
                onChange={(e) => onOwnerUpdate({ ...owner, postalCode: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-300">Ville *</Label>
              <Input
                value={owner.city || ""}
                onChange={(e) => onOwnerUpdate({ ...owner, city: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Email</Label>
              <Input
                type="email"
                value={owner.email || ""}
                onChange={(e) => onOwnerUpdate({ ...owner, email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-300">Téléphone</Label>
              <Input
                value={owner.phone || ""}
                onChange={(e) => onOwnerUpdate({ ...owner, phone: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locataire */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5 text-purple-400" />
            Le Locataire
          </CardTitle>
          <CardDescription className="text-slate-400">
            Personne qui louera le parking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={tenant.type || "particulier"}
            onValueChange={(v) => onTenantUpdate({ ...tenant, type: v })}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor="tenant-particulier"
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                tenant.type === "particulier"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="particulier" id="tenant-particulier" />
              <span className="text-white">Particulier</span>
            </Label>
            <Label
              htmlFor="tenant-societe"
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                tenant.type === "societe"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-slate-600 hover:border-slate-500"
              )}
            >
              <RadioGroupItem value="societe" id="tenant-societe" />
              <span className="text-white">Société</span>
            </Label>
          </RadioGroup>

          {tenant.type === "particulier" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Prénom *</Label>
                  <Input
                    value={tenant.firstName || ""}
                    onChange={(e) => onTenantUpdate({ ...tenant, firstName: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-2"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Nom *</Label>
                  <Input
                    value={tenant.lastName || ""}
                    onChange={(e) => onTenantUpdate({ ...tenant, lastName: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-300">Date de naissance</Label>
                  <Input
                    type="date"
                    value={tenant.birthDate || ""}
                    onChange={(e) => onTenantUpdate({ ...tenant, birthDate: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-2"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Lieu de naissance</Label>
                  <Input
                    value={tenant.birthPlace || ""}
                    onChange={(e) => onTenantUpdate({ ...tenant, birthPlace: e.target.value })}
                    className="bg-slate-700 border-slate-600 text-white mt-2"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Raison sociale *</Label>
                <Input
                  value={tenant.companyName || ""}
                  onChange={(e) => onTenantUpdate({ ...tenant, companyName: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
              <div>
                <Label className="text-slate-300">SIRET</Label>
                <Input
                  value={tenant.siret || ""}
                  onChange={(e) => onTenantUpdate({ ...tenant, siret: e.target.value })}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>
            </div>
          )}

          <div>
            <Label className="text-slate-300">Adresse actuelle *</Label>
            <Input
              value={tenant.currentAddress || ""}
              onChange={(e) => onTenantUpdate({ ...tenant, currentAddress: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white mt-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Code postal *</Label>
              <Input
                value={tenant.postalCode || ""}
                onChange={(e) => onTenantUpdate({ ...tenant, postalCode: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-300">Ville *</Label>
              <Input
                value={tenant.city || ""}
                onChange={(e) => onTenantUpdate({ ...tenant, city: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Email</Label>
              <Input
                type="email"
                value={tenant.email || ""}
                onChange={(e) => onTenantUpdate({ ...tenant, email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
            <div>
              <Label className="text-slate-300">Téléphone</Label>
              <Input
                value={tenant.phone || ""}
                onChange={(e) => onTenantUpdate({ ...tenant, phone: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white mt-2"
              />
            </div>
          </div>

          {/* Véhicule */}
          <Separator className="bg-slate-700" />
          <div>
            <Label className="text-slate-300 flex items-center gap-2">
              <Car className="h-4 w-4" />
              Immatriculation du véhicule
            </Label>
            <Input
              placeholder="Ex: AB-123-CD"
              value={tenant.licensePlate || ""}
              onChange={(e) => onTenantUpdate({ ...tenant, licensePlate: e.target.value.toUpperCase() })}
              className="bg-slate-700 border-slate-600 text-white mt-2 font-mono uppercase"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// ÉTAPE 6 : RÉCAPITULATIF
// ============================================

function StepPreview({
  formData,
  isGenerating,
  onGenerate,
}: {
  formData: any;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const preset = formData.category ? getParkingPreset(formData.category) : null;
  const financial = formData.conditions.financial || {};
  const totalMonthly = (financial.rentMonthly || 0) + (financial.chargesMonthly || 0);

  return (
    <div className="space-y-6">
      {/* Résumé visuel */}
      <Card className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 border-slate-700 backdrop-blur-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
        <CardHeader className="relative">
          <CardTitle className="text-white text-2xl flex items-center gap-3">
            <span className="text-4xl">{preset?.icon || "🅿️"}</span>
            Contrat de Location - {preset?.label || "Parking"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Vérifiez les informations avant de générer le contrat
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-6">
          {/* Grille récapitulative */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Parking */}
            <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-600">
              <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <Car className="h-4 w-4" />
                Emplacement
              </h4>
              <p className="text-lg font-semibold text-white">
                N° {formData.specifications.location?.numero || "—"}
              </p>
              {formData.specifications.location?.niveau && (
                <p className="text-sm text-slate-400">
                  Niveau {formData.specifications.location.niveau}
                </p>
              )}
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.specifications.features?.couvert && (
                  <Badge variant="outline" className="text-xs border-slate-500">Couvert</Badge>
                )}
                {formData.specifications.features?.ferme && (
                  <Badge variant="outline" className="text-xs border-slate-500">Fermé</Badge>
                )}
              </div>
            </div>

            {/* Durée */}
            <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-600">
              <h4 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Durée
              </h4>
              <p className="text-lg font-semibold text-white">
                {formData.conditions.duration?.type === "indeterminee" 
                  ? "Indéterminée" 
                  : `${formData.conditions.duration?.months || 12} mois`}
              </p>
              <p className="text-sm text-slate-400">
                À partir du {new Date(formData.conditions.duration?.startDate || Date.now()).toLocaleDateString("fr-FR")}
              </p>
            </div>

            {/* Loyer */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-700/30">
              <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Loyer mensuel
              </h4>
              <p className="text-2xl font-bold text-green-400">
                {totalMonthly} €
              </p>
              <p className="text-sm text-slate-400">
                Dépôt : {financial.deposit || 0} €
              </p>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-600">
              <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Bailleur
              </h4>
              <p className="text-white font-medium">
                {formData.owner.type === "societe" 
                  ? formData.owner.companyName 
                  : `${formData.owner.firstName || ""} ${formData.owner.lastName || ""}`}
              </p>
              <p className="text-sm text-slate-400">{formData.owner.address}</p>
              <p className="text-sm text-slate-400">
                {formData.owner.postalCode} {formData.owner.city}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-600">
              <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Locataire
              </h4>
              <p className="text-white font-medium">
                {formData.tenant.type === "societe" 
                  ? formData.tenant.companyName 
                  : `${formData.tenant.firstName || ""} ${formData.tenant.lastName || ""}`}
              </p>
              <p className="text-sm text-slate-400">{formData.tenant.currentAddress}</p>
              <p className="text-sm text-slate-400">
                {formData.tenant.postalCode} {formData.tenant.city}
              </p>
              {formData.tenant.licensePlate && (
                <Badge className="mt-2 font-mono">{formData.tenant.licensePlate}</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                <Check className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Prêt à générer</p>
                <p className="text-sm text-slate-400">
                  Votre contrat sera créé au format PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
              >
                <Eye className="h-4 w-4 mr-2" />
                Aperçu
              </Button>
              <Button
                onClick={onGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {isGenerating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                    </motion.div>
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Générer le contrat
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ParkingLeaseWizard;


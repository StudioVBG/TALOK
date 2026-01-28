"use client";
// @ts-nocheck

import { motion } from "framer-motion";
import {
  Home,
  Sofa,
  Users,
  Sun,
  Briefcase,
  Clock,
  Shield,
  Scale,
  Layers,
  FileText,
  Settings,
  Sparkles,
  Car,
  Store,
  Building2,
  CalendarClock,
  Key,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Configuration des types de baux avec design premium
export const LEASE_TYPE_CONFIGS = {
  nu: {
    name: "Location Vide",
    description: "Bail classique pour logement non meublé",
    icon: Home,
    gradient: "from-slate-600 via-slate-500 to-zinc-600",
    bgGradient: "from-slate-50 to-zinc-100 dark:from-slate-900/50 dark:to-zinc-900/50",
    accent: "#475569",
    accentLight: "#94a3b8",
    features: [
      { label: "Durée minimum", value: "3 ans", icon: Clock },
      { label: "Dépôt de garantie", value: "1 mois max", icon: Shield },
      { label: "Préavis locataire", value: "3 mois", icon: Scale },
    ],
    legalRef: "Loi 89-462, Décret 2015-587",
    durationMonths: 36,
    maxDepositMonths: 1,
  },
  meuble: {
    name: "Location Meublée",
    description: "Logement équipé selon décret 2015-981",
    icon: Sofa,
    gradient: "from-blue-600 via-cyan-500 to-teal-500",
    bgGradient: "from-blue-50 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50",
    accent: "#0891b2",
    accentLight: "#22d3ee",
    features: [
      { label: "Durée minimum", value: "1 an", icon: Clock },
      { label: "Dépôt de garantie", value: "2 mois max", icon: Shield },
      { label: "Inventaire", value: "Obligatoire", icon: Layers },
    ],
    legalRef: "Décret 2015-981, Art. 25-4",
    durationMonths: 12,
    maxDepositMonths: 2,
  },
  colocation: {
    name: "Colocation",
    description: "Bail unique ou individuel avec clause solidarité",
    icon: Users,
    gradient: "from-violet-600 via-purple-500 to-fuchsia-500",
    bgGradient: "from-violet-50 to-purple-100 dark:from-violet-900/50 dark:to-purple-900/50",
    accent: "#8b5cf6",
    accentLight: "#c4b5fd",
    features: [
      { label: "Clause solidarité", value: "Max 6 mois", icon: Scale },
      { label: "Quote-parts", value: "Personnalisables", icon: Settings },
      { label: "Signatures", value: "Multi-parties", icon: FileText },
    ],
    legalRef: "Art. 8-1 Loi 1989",
    durationMonths: 12,
    maxDepositMonths: 2,
  },
  saisonnier: {
    name: "Saisonnier",
    description: "Location courte durée non principale",
    icon: Sun,
    gradient: "from-amber-500 via-orange-500 to-red-500",
    bgGradient: "from-amber-50 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50",
    accent: "#f59e0b",
    accentLight: "#fcd34d",
    features: [
      { label: "Durée maximum", value: "90 jours", icon: Clock },
      { label: "Taxe séjour", value: "Applicable", icon: Scale },
      { label: "Arrhes", value: "Personnalisables", icon: Shield },
    ],
    legalRef: "Art. 1-1 Loi 1989",
    durationMonths: 3,
    maxDepositMonths: 0,
  },
  // Clé = bail_mobilite (correspondant à la contrainte BDD)
  bail_mobilite: {
    name: "Bail Mobilité",
    description: "Location temporaire pour personnes en mobilité",
    icon: Briefcase,
    gradient: "from-indigo-600 via-purple-500 to-pink-500",
    bgGradient: "from-indigo-50 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50",
    accent: "#6366f1",
    accentLight: "#a5b4fc",
    features: [
      { label: "Durée", value: "1-10 mois", icon: Clock },
      { label: "Dépôt de garantie", value: "Interdit", icon: Shield },
      { label: "Renouvellement", value: "Non renouvelable", icon: Scale },
    ],
    legalRef: "Loi ELAN 2018",
    durationMonths: 10,
    maxDepositMonths: 0,
  },
  // Clé = contrat_parking (correspondant à la contrainte BDD)
  contrat_parking: {
    name: "Bail Parking",
    description: "Location de place de stationnement ou box",
    icon: Car,
    gradient: "from-emerald-600 via-teal-500 to-cyan-500",
    bgGradient: "from-emerald-50 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50",
    accent: "#059669",
    accentLight: "#34d399",
    features: [
      { label: "Durée", value: "Libre", icon: Clock },
      { label: "Dépôt de garantie", value: "Libre", icon: Shield },
      { label: "Préavis", value: "1 mois min", icon: CalendarClock },
    ],
    legalRef: "Code civil (art. 1709)",
    durationMonths: 12,
    maxDepositMonths: 2,
  },
  // Clé = commercial_3_6_9 (correspondant à la contrainte BDD)
  commercial_3_6_9: {
    name: "Bail Commercial 3/6/9",
    description: "Location de locaux commerciaux ou artisanaux",
    icon: Store,
    gradient: "from-rose-600 via-pink-500 to-red-500",
    bgGradient: "from-rose-50 to-pink-100 dark:from-rose-900/50 dark:to-pink-900/50",
    accent: "#e11d48",
    accentLight: "#fb7185",
    features: [
      { label: "Durée minimum", value: "9 ans", icon: Clock },
      { label: "Résiliation", value: "Tous les 3 ans", icon: CalendarClock },
      { label: "Droit au bail", value: "Cessible", icon: Key },
    ],
    legalRef: "Art. L.145-1 Code commerce",
    durationMonths: 108,
    maxDepositMonths: 3,
  },
  // Clé = professionnel (correspondant à la contrainte BDD)
  professionnel: {
    name: "Bail Professionnel",
    description: "Location pour professions libérales et bureaux",
    icon: Building2,
    gradient: "from-sky-600 via-blue-500 to-indigo-500",
    bgGradient: "from-sky-50 to-blue-100 dark:from-sky-900/50 dark:to-blue-900/50",
    accent: "#0284c7",
    accentLight: "#38bdf8",
    features: [
      { label: "Durée minimum", value: "6 ans", icon: Clock },
      { label: "Préavis locataire", value: "6 mois", icon: CalendarClock },
      { label: "Tacite reconduction", value: "Oui", icon: Scale },
    ],
    legalRef: "Art. 57A Loi 23/12/1986",
    durationMonths: 72,
    maxDepositMonths: 2,
  },
  // Bail étudiant (meublé 9 mois non renouvelable)
  etudiant: {
    name: "Bail Étudiant",
    description: "Bail meublé de 9 mois pour étudiants",
    icon: FileText,
    gradient: "from-lime-600 via-green-500 to-emerald-500",
    bgGradient: "from-lime-50 to-green-100 dark:from-lime-900/50 dark:to-green-900/50",
    accent: "#65a30d",
    accentLight: "#a3e635",
    features: [
      { label: "Durée", value: "9 mois", icon: Clock },
      { label: "Dépôt de garantie", value: "1 mois max", icon: Shield },
      { label: "Renouvellement", value: "Non automatique", icon: Scale },
    ],
    legalRef: "Art. 25-7 Loi n°89-462",
    durationMonths: 9,
    maxDepositMonths: 1,
  },
  // Commercial dérogatoire (bail précaire)
  commercial_derogatoire: {
    name: "Commercial Dérogatoire",
    description: "Bail commercial précaire (max 3 ans)",
    icon: Store,
    gradient: "from-orange-600 via-amber-500 to-yellow-500",
    bgGradient: "from-orange-50 to-amber-100 dark:from-orange-900/50 dark:to-amber-900/50",
    accent: "#ea580c",
    accentLight: "#fb923c",
    features: [
      { label: "Durée maximum", value: "3 ans", icon: Clock },
      { label: "Droit au bail", value: "Non cessible", icon: Key },
      { label: "Renouvellement", value: "Sur accord", icon: CalendarClock },
    ],
    legalRef: "Art. L.145-5 Code commerce",
    durationMonths: 36,
    maxDepositMonths: 3,
  },
  // Location-gérance (fonds de commerce)
  location_gerance: {
    name: "Location-Gérance",
    description: "Mise en gérance d'un fonds de commerce",
    icon: Store,
    gradient: "from-fuchsia-600 via-pink-500 to-rose-500",
    bgGradient: "from-fuchsia-50 to-pink-100 dark:from-fuchsia-900/50 dark:to-pink-900/50",
    accent: "#c026d3",
    accentLight: "#e879f9",
    features: [
      { label: "Durée", value: "Libre (min 2 ans)", icon: Clock },
      { label: "Redevance", value: "Fixe ou variable", icon: Scale },
      { label: "Publication", value: "JAL obligatoire", icon: FileText },
    ],
    legalRef: "Art. L.144-1 Code commerce",
    durationMonths: 24,
    maxDepositMonths: 3,
  },
  // Bail mixte (habitation + professionnel)
  bail_mixte: {
    name: "Bail Mixte",
    description: "Logement avec activité professionnelle",
    icon: Layers,
    gradient: "from-cyan-600 via-teal-500 to-emerald-500",
    bgGradient: "from-cyan-50 to-teal-100 dark:from-cyan-900/50 dark:to-teal-900/50",
    accent: "#0891b2",
    accentLight: "#22d3ee",
    features: [
      { label: "Durée minimum", value: "3 ans (6 si bailleur pro)", icon: Clock },
      { label: "Dépôt de garantie", value: "1 mois max", icon: Shield },
      { label: "Usage", value: "Habitation + libéral", icon: Briefcase },
    ],
    legalRef: "Art. 2 Loi n°89-462",
    durationMonths: 36,
    maxDepositMonths: 1,
  },
  // Bail rural
  bail_rural: {
    name: "Bail Rural",
    description: "Location de terres et bâtiments agricoles",
    icon: Home,
    gradient: "from-green-700 via-emerald-600 to-teal-600",
    bgGradient: "from-green-50 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50",
    accent: "#15803d",
    accentLight: "#4ade80",
    features: [
      { label: "Durée minimum", value: "9 ans", icon: Clock },
      { label: "Préavis", value: "18 mois", icon: CalendarClock },
      { label: "Droit de préemption", value: "SAFER", icon: Scale },
    ],
    legalRef: "Art. L.411-1 Code rural",
    durationMonths: 108,
    maxDepositMonths: 0,
  },
} as const;

export type LeaseType = keyof typeof LEASE_TYPE_CONFIGS;

interface LeaseTypeCardsProps {
  selectedType: LeaseType | null;
  onSelect: (type: LeaseType) => void;
  propertyType?: string;
}

// Animation variants
const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -8, transition: { type: "spring" as const, stiffness: 400 } },
};

// Filtrer les types de baux disponibles selon le type de bien
function getAvailableLeaseTypes(propertyType?: string): LeaseType[] {
  if (!propertyType) return Object.keys(LEASE_TYPE_CONFIGS) as LeaseType[];

  const mapping: Record<string, LeaseType[]> = {
    // Habitation
    appartement: ["nu", "meuble", "bail_mobilite", "etudiant", "bail_mixte"],
    maison: ["nu", "meuble", "bail_mixte"],
    studio: ["meuble", "bail_mobilite", "etudiant"],
    colocation: ["colocation", "meuble"],
    saisonnier: ["saisonnier"],
    // Stationnement
    parking: ["contrat_parking"],
    box: ["contrat_parking"],
    // Professionnel
    local_commercial: ["commercial_3_6_9", "commercial_derogatoire"],
    bureaux: ["professionnel", "commercial_3_6_9", "commercial_derogatoire", "bail_mixte"],
    entrepot: ["commercial_3_6_9", "professionnel", "commercial_derogatoire"],
    fonds_de_commerce: ["commercial_3_6_9", "commercial_derogatoire", "location_gerance"],
    // Agricole
    terrain_agricole: ["bail_rural"],
    exploitation_agricole: ["bail_rural"],
  };

  return mapping[propertyType] || ["nu", "meuble", "colocation", "saisonnier", "bail_mobilite", "etudiant"];
}

export function LeaseTypeCards({ selectedType, onSelect, propertyType }: LeaseTypeCardsProps) {
  const availableTypes = getAvailableLeaseTypes(propertyType);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Choisissez le type de bail</h3>
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          Conforme loi ALUR
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {availableTypes.map((type) => {
          const config = LEASE_TYPE_CONFIGS[type];
          const Icon = config.icon;
          const isSelected = selectedType === type;
          
          return (
            <motion.div
              key={type}
              variants={cardHoverVariants}
              initial="rest"
              whileHover="hover"
              whileTap={{ scale: 0.98 }}
              animate={isSelected ? { scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 0.3 }}
              className="relative group cursor-pointer"
              onClick={() => onSelect(type)}
            >
              {/* Glow effect */}
              <div
                className={cn(
                  "absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl",
                  isSelected && "opacity-100"
                )}
                style={{
                  background: `linear-gradient(135deg, ${config.accent}40, ${config.accentLight}30)`,
                }}
              />

              {/* Card */}
              <div className={cn(
                "relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-xl border-2 overflow-hidden shadow-lg transition-all duration-300",
                isSelected 
                  ? "border-primary ring-2 ring-primary/20" 
                  : "border-white/30 dark:border-slate-700/50 hover:border-slate-300"
              )}>
                {/* Header avec gradient */}
                <div
                  className={cn(
                    "relative h-24 flex items-center justify-center overflow-hidden",
                    `bg-gradient-to-br ${config.gradient}`
                  )}
                >
                  {/* Pattern de fond */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                      backgroundSize: "20px 20px",
                    }} />
                  </div>

                  {/* Icon avec animation */}
                  <motion.div
                    animate={isSelected ? {
                      y: [0, -5, 0],
                      rotate: [0, 3, -3, 0],
                    } : {}}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="relative z-10"
                  >
                    <Icon className="h-10 w-10 text-white/90 drop-shadow-lg" />
                  </motion.div>

                  {/* Badge sélectionné */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2"
                    >
                      <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                        ✓ Sélectionné
                      </Badge>
                    </motion.div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {config.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {config.description}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5">
                    {config.features.map((feature, i) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <FeatureIcon className="h-3 w-3" />
                            {feature.label}
                          </span>
                          <span className="font-medium" style={{ color: config.accent }}>
                            {feature.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legal ref */}
                  <p className="text-[10px] text-muted-foreground pt-2 border-t">
                    📋 {config.legalRef}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


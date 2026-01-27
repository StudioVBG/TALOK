"use client";

import { useMemo } from "react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import {
  MapPin, Home, Ruler, Euro, Image as ImageIcon,
  Edit2, AlertCircle, Car, LayoutGrid, Building,
  Sparkles, Calendar, Globe, Lock, CheckCircle2, XCircle, AlertTriangle
} from "lucide-react";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { isDPEObligatoire, getDPEErrorMessage, isDROM } from "@/lib/helpers/address-utils";

const TYPES_WITHOUT_ROOMS = ["parking", "box", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce", "immeuble"];

// SOTA 2026: Types de biens habitation (nécessitent DPE, chauffage, etc.)
const HABITATION_TYPES = ["appartement", "maison", "studio", "colocation", "saisonnier"];
const PARKING_TYPES = ["parking", "box"];
const PRO_TYPES = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];

// SOTA 2026: Liste des champs requis pour la publication
interface ValidationField {
  key: string;
  label: string;
  check: (formData: any, rooms: any[], photos: any[]) => boolean;
  required: boolean | ((formData: any) => boolean);
  category: "base" | "habitation" | "parking" | "pro" | "immeuble" | "media";
  errorMessage?: (formData: any) => string;
}

// SOTA 2026: Validation dynamique selon le type de bien
const VALIDATION_FIELDS: ValidationField[] = [
  // === Champs de base (tous types) ===
  {
    key: "type",
    label: "Type de bien",
    check: (f) => !!f.type || !!f.type_bien,
    required: true,
    category: "base"
  },
  {
    key: "adresse",
    label: "Adresse complète",
    check: (f) => !!f.adresse_complete && !!f.code_postal && !!f.ville,
    required: true,
    category: "base"
  },

  // === Champs habitation ===
  {
    key: "usage",
    label: "Usage principal",
    check: (f) => !!f.usage_principal,
    required: (f) => HABITATION_TYPES.includes(f.type || f.type_bien || ""),
    category: "habitation"
  },
  {
    key: "surface",
    label: "Surface habitable",
    check: (f) => (f.surface || f.surface_habitable_m2) > 0,
    required: (f) => HABITATION_TYPES.includes(f.type || f.type_bien || ""),
    category: "habitation"
  },
  {
    key: "loyer",
    label: "Loyer HC",
    check: (f) => (f.loyer_hc) > 0,
    required: (f) => !["immeuble"].includes(f.type || f.type_bien || ""),
    category: "habitation"
  },
  {
    key: "dpe",
    label: "DPE (Classe énergie)",
    check: (f) => !!f.dpe_classe_energie && f.dpe_classe_energie !== "NC",
    required: (f) => isDPEObligatoire(f.type || f.type_bien || ""),
    category: "habitation",
    errorMessage: (f) => getDPEErrorMessage(f.code_postal)
  },
  {
    key: "chauffage",
    label: "Chauffage",
    check: (f) => !!f.chauffage_type,
    required: (f) => HABITATION_TYPES.includes(f.type || f.type_bien || ""),
    category: "habitation"
  },
  {
    key: "eau_chaude",
    label: "Eau chaude",
    check: (f) => !!f.eau_chaude_type,
    required: (f) => HABITATION_TYPES.includes(f.type || f.type_bien || ""),
    category: "habitation"
  },

  // === Champs parking ===
  {
    key: "parking_type",
    label: "Type de parking",
    check: (f) => !!f.parking_type,
    required: (f) => PARKING_TYPES.includes(f.type || f.type_bien || ""),
    category: "parking"
  },

  // === Champs immeuble ===
  {
    key: "building_units",
    label: "Lots configurés",
    check: (f) => f.building_units && f.building_units.length > 0,
    required: (f) => (f.type || f.type_bien) === "immeuble",
    category: "immeuble"
  },
  {
    key: "building_floors",
    label: "Nombre d'étages",
    check: (f) => f.building_floors && f.building_floors > 0,
    required: (f) => (f.type || f.type_bien) === "immeuble",
    category: "immeuble"
  },

  // === Médias ===
  {
    key: "photos",
    label: "Photos (min. 1)",
    check: (_, __, p) => p.length >= 1,
    required: false,
    category: "media"
  },
];

export function RecapStep() {
  const { formData, rooms, photos, setStep, mode } = usePropertyWizardStore();

  // SOTA 2026: Calcul de la validation avec required dynamique
  const validation = useMemo(() => {
    const propertyType = formData.type || formData.type_bien || "";
    const isDromLocation = isDROM(formData.code_postal as string);

    // Filtrer les champs applicables selon le type de bien
    const applicableFields = VALIDATION_FIELDS.filter(field => {
      if (field.category === "base" || field.category === "media") return true;
      if (field.category === "habitation" && HABITATION_TYPES.includes(propertyType)) return true;
      if (field.category === "parking" && PARKING_TYPES.includes(propertyType)) return true;
      if (field.category === "pro" && PRO_TYPES.includes(propertyType)) return true;
      if (field.category === "immeuble" && propertyType === "immeuble") return true;
      return false;
    });

    const results = applicableFields.map(field => {
      const isRequired = typeof field.required === "function"
        ? field.required(formData)
        : field.required;
      const isValid = field.check(formData, rooms, photos);
      const errorMsg = field.errorMessage ? field.errorMessage(formData) : undefined;

      return {
        ...field,
        isRequired,
        isValid,
        errorMessage: !isValid && isRequired ? errorMsg : undefined,
      };
    });

    const requiredValid = results.filter(r => r.isRequired && r.isValid).length;
    const requiredTotal = results.filter(r => r.isRequired).length;
    const allValid = requiredValid === requiredTotal;
    const score = requiredTotal > 0 ? Math.round((requiredValid / requiredTotal) * 100) : 100;

    // Messages d'alerte spécifiques DOM-TOM
    const dromWarnings: string[] = [];
    if (isDromLocation && HABITATION_TYPES.includes(propertyType)) {
      if (!formData.dpe_classe_energie || formData.dpe_classe_energie === "NC") {
        dromWarnings.push(getDPEErrorMessage(formData.code_postal as string));
      }
    }

    return { results, allValid, score, requiredValid, requiredTotal, isDromLocation, dromWarnings };
  }, [formData, rooms, photos]);

  const propertyType = (formData.type as string) || "";
  const hasRooms = !TYPES_WITHOUT_ROOMS.includes(propertyType);
  const getTypeLabel = (type: string) => type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : "—";
  const mainPhoto = photos.find(p => p.is_main) || photos[0];
  const equipments = formData.equipments || [];
  const availableFrom = formData.available_from ? new Date(formData.available_from) : null;
  const visibility = (formData as any).visibility || "private";

  const Section = ({ title, step, children, icon: Icon, className }: { title: string; step: 'type_bien' | 'address' | 'details' | 'rooms' | 'photos' | 'features' | 'publish' | 'building_config'; children: React.ReactNode; icon: any; className?: string }) => (
    <Card 
      className={cn("group hover:border-primary/50 transition-colors cursor-pointer overflow-hidden relative", className)}
      onClick={() => setStep(step)}
    >
      <CardContent className="p-5 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Icon className="h-3.5 w-3.5" /> {title}
          </div>
          <Edit2 className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {children}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col justify-center max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">Récapitulatif de votre annonce</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-fr">
          {/* Type - Colonne 1 */}
          <Section title="Type de bien" step="type_bien" icon={Home}>
            <p className="font-bold text-xl capitalize">{getTypeLabel(propertyType)}</p>
          </Section>

          {/* Adresse - Colonne 2 */}
          <Section title="Adresse" step="address" icon={MapPin}>
            {formData.adresse_complete ? (
              <>
                <p className="font-medium text-base line-clamp-2">{formData.adresse_complete}</p>
                <p className="text-sm text-muted-foreground mt-1">{formData.code_postal} {formData.ville}</p>
              </>
            ) : (
              <p className="text-muted-foreground italic">Adresse à définir</p>
            )}
          </Section>

          {/* Détails - Colonne 3 */}
          <Section title="Caractéristiques" step="details" icon={Ruler}>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="font-bold text-2xl">{formData.surface_habitable_m2 || formData.surface || 0}</span>
                <span className="text-sm text-muted-foreground">m²</span>
              </div>
              <div className="flex items-center gap-1 text-primary font-medium">
                <Euro className="h-4 w-4" />
                <span className="text-lg">{formData.loyer_hc || 0}</span>
                <span className="text-xs text-muted-foreground">/mois</span>
              </div>
            </div>
          </Section>

          {/* Pièces / Immeuble / Parking - Colonne 1 & 2 (Large) */}
          {propertyType === "immeuble" ? (
            <Section title="Configuration Immeuble" step="building_config" icon={Building} className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{formData.building_floors || 0}</span>
                  <span className="text-sm text-muted-foreground">étage{(formData.building_floors || 0) > 1 ? 's' : ''}</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{(formData.building_units as any[])?.length || 0}</span>
                  <span className="text-sm text-muted-foreground">lot{((formData.building_units as any[])?.length || 0) > 1 ? 's' : ''}</span>
                </div>
                {(formData.building_units as any[])?.length > 0 && (
                  <>
                    <div className="h-8 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">
                        {(formData.building_units as any[]).reduce((acc: number, u: any) => acc + (u.surface || 0), 0)}
                      </span>
                      <span className="text-sm text-muted-foreground">m² total</span>
                    </div>
                  </>
                )}
              </div>
              {/* Mini aperçu des lots */}
              {(formData.building_units as any[])?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(formData.building_units as any[]).slice(0, 8).map((unit: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {unit.template?.toUpperCase() || unit.type} • {unit.surface}m²
                    </Badge>
                  ))}
                  {(formData.building_units as any[]).length > 8 && (
                    <Badge variant="outline" className="text-[10px]">
                      +{(formData.building_units as any[]).length - 8} autres
                    </Badge>
                  )}
                </div>
              )}
            </Section>
          ) : hasRooms ? (
            <Section title="Pièces & Espaces" step="rooms" icon={LayoutGrid} className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-2xl font-bold">{rooms.length}</span>
                  <span className="text-sm text-muted-foreground">pièce{rooms.length > 1 ? 's' : ''}</span>
                </div>
                <div className="flex -space-x-2">
                  {rooms.slice(0, 6).map((room, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div className="h-9 w-9 rounded-full bg-background border-2 border-muted flex items-center justify-center text-xs font-bold shadow-sm hover:scale-110 transition-transform cursor-help z-10">
                          {room.label_affiche?.charAt(0)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{room.label_affiche} ({room.surface_m2} m²)</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {rooms.length > 6 && (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border-2 border-background text-xs font-medium z-0">
                      +{rooms.length - 6}
                    </div>
                  )}
                </div>
              </div>
            </Section>
          ) : (
            <Section title="Type de stationnement" step="details" icon={Car} className="md:col-span-2">
              <p className="font-medium text-lg">{formData.parking_type || "Standard"}</p>
            </Section>
          )}

          {/* Photos - Colonne 3 */}
          <Section title="Photos" step="photos" icon={ImageIcon}>
            {photos.length > 0 ? (
              <div className="relative w-full h-24 rounded-lg overflow-hidden">
                {mainPhoto && (
                  <Image src={mainPhoto.url} alt="Main" fill sizes="(max-width: 768px) 100vw, 200px" className="object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <p className="text-white font-bold text-lg flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" /> {photos.length}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 text-muted-foreground">
                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-xs">Aucune photo</span>
              </div>
            )}
          </Section>

          {/* Équipements - Mode FULL uniquement - Colonne 1 & 2 */}
          {mode === 'full' && (
            <Section title="Équipements" step="features" icon={Sparkles} className="md:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {equipments.length > 0 ? (
                  equipments.map((eq) => (
                    <span key={eq} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                      {eq.replace(/_/g, ' ')}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aucun équipement sélectionné</p>
                )}
              </div>
            </Section>
          )}

          {/* Publication - Mode FULL uniquement - Colonne 3 */}
          {mode === 'full' && (
            <Section title="Publication" step="publish" icon={Calendar}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {visibility === 'public' ? (
                    <><Globe className="h-4 w-4 text-green-600" /> Public</>
                  ) : (
                    <><Lock className="h-4 w-4 text-amber-600" /> Privé</>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Dispo : {availableFrom ? format(availableFrom, 'dd/MM/yyyy', { locale: fr }) : 'Immédiate'}
                </p>
              </div>
            </Section>
          )}
        </div>
        
        {/* SOTA 2026: Alerte DOM-TOM si applicable */}
        {validation.isDromLocation && validation.dromWarnings.length > 0 && (
          <div className="mt-6 p-4 rounded-xl border border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  Réglementation DOM-TOM
                </p>
                <ul className="mt-1 space-y-1">
                  {validation.dromWarnings.map((warning, i) => (
                    <li key={i} className="text-sm text-blue-700 dark:text-blue-300">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SOTA 2026: Panneau de validation détaillé */}
        <div className={cn(
          "mt-6 p-4 rounded-xl border shadow-sm",
          validation.allValid
            ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
        )} role="region" aria-label="État de validation de l'annonce">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            {validation.allValid ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200">Prêt pour publication</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Toutes les informations obligatoires sont remplies.</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Informations manquantes ({validation.requiredValid}/{validation.requiredTotal})
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Complétez les champs ci-dessous pour publier l'annonce.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Liste de validation */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {validation.results.map((field) => (
              <Tooltip key={field.key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium cursor-help",
                      field.isValid
                        ? "bg-green-100/50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                        : field.isRequired
                          ? "bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                          : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {field.isValid ? (
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{field.label}</span>
                    {field.isRequired && !field.isValid && (
                      <Badge variant="destructive" className="ml-auto text-[8px] px-1 py-0 flex-shrink-0">Requis</Badge>
                    )}
                  </div>
                </TooltipTrigger>
                {field.errorMessage && (
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">{field.errorMessage}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>

          {/* SOTA 2026: Affichage des erreurs détaillées pour les champs bloquants */}
          {!validation.allValid && (
            <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                Champs à compléter :
              </p>
              <ul className="space-y-1">
                {validation.results
                  .filter(f => f.isRequired && !f.isValid)
                  .map(f => (
                    <li key={f.key} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>
                        <strong>{f.label}</strong>
                        {f.errorMessage && <span className="block text-[10px] opacity-80 mt-0.5">{f.errorMessage}</span>}
                      </span>
                    </li>
                  ))
                }
              </ul>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

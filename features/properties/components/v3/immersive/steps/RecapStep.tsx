"use client";

import { useMemo } from "react";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import {
  MapPin, Home, Ruler, Euro, Image as ImageIcon,
  Edit2, AlertCircle, Car, LayoutGrid,
  Sparkles, Calendar, Globe, Lock, CheckCircle2, XCircle
} from "lucide-react";
import Image from "next/image";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const TYPES_WITHOUT_ROOMS = ["parking", "box", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];

// SOTA 2026: Liste des champs requis pour la publication
interface ValidationField {
  key: string;
  label: string;
  check: (formData: any, rooms: any[], photos: any[]) => boolean;
  required: boolean;
}

const VALIDATION_FIELDS: ValidationField[] = [
  { key: "type", label: "Type de bien", check: (f) => !!f.type || !!f.type_bien, required: true },
  { key: "adresse", label: "Adresse complète", check: (f) => !!f.adresse_complete && !!f.code_postal && !!f.ville, required: true },
  { key: "surface", label: "Surface", check: (f) => (f.surface || f.surface_habitable_m2) > 0, required: true },
  { key: "loyer", label: "Loyer", check: (f) => (f.loyer_hc || f.loyer_base) > 0, required: true },
  { key: "dpe", label: "DPE", check: (f) => !!f.dpe_classe_energie, required: true },
  { key: "chauffage", label: "Chauffage", check: (f) => !!f.chauffage_type, required: true },
  { key: "photos", label: "Photos (min. 1)", check: (_, __, p) => p.length >= 1, required: false },
];

export function RecapStep() {
  const { formData, rooms, photos, setStep, mode } = usePropertyWizardStore();

  // SOTA 2026: Calcul de la validation
  const validation = useMemo(() => {
    const results = VALIDATION_FIELDS.map(field => ({
      ...field,
      isValid: field.check(formData, rooms, photos),
    }));
    const requiredValid = results.filter(r => r.required && r.isValid).length;
    const requiredTotal = results.filter(r => r.required).length;
    const allValid = requiredValid === requiredTotal;
    const score = Math.round((requiredValid / requiredTotal) * 100);
    return { results, allValid, score, requiredValid, requiredTotal };
  }, [formData, rooms, photos]);

  const propertyType = (formData.type as string) || "";
  const hasRooms = !TYPES_WITHOUT_ROOMS.includes(propertyType);
  const getTypeLabel = (type: string) => type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : "—";
  const mainPhoto = photos.find(p => p.is_main) || photos[0];
  const equipments = formData.equipments || [];
  const availableFrom = formData.available_from ? new Date(formData.available_from) : null;
  const visibility = (formData as any).visibility || "private";

  const Section = ({ title, step, children, icon: Icon, className }: { title: string; step: 'type_bien' | 'address' | 'details' | 'rooms' | 'photos' | 'features' | 'publish'; children: React.ReactNode; icon: any; className?: string }) => (
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

          {/* Pièces - Colonne 1 & 2 (Large) */}
          {hasRooms ? (
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
              <div
                key={field.key}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium",
                  field.isValid
                    ? "bg-green-100/50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                    : field.required
                      ? "bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                      : "bg-muted/50 text-muted-foreground"
                )}
              >
                {field.isValid ? (
                  <CheckCircle2 className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                )}
                <span>{field.label}</span>
                {field.required && !field.isValid && (
                  <Badge variant="destructive" className="ml-auto text-[8px] px-1 py-0">Requis</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

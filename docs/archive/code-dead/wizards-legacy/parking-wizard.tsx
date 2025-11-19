"use client";

import { useMemo, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import type {
  ParkingAccessType,
  ParkingDetails,
  ParkingPlacementType,
  ParkingSecurityFeature,
  ParkingVehicleProfile,
  Property,
} from "@/lib/types";
import type { CreatePropertyData } from "../services/properties.service";

const DEFAULT_STEPS = [
  "Contexte",
  "Caractéristiques",
  "Accès & sécurité",
  "Loyer & dépôt",
  "Photos",
  "Résumé",
];

const placementOptions: { value: ParkingPlacementType; label: string }[] = [
  { value: "outdoor", label: "Place extérieure" },
  { value: "covered", label: "Place couverte" },
  { value: "box", label: "Box fermé" },
  { value: "underground", label: "Parking souterrain" },
];

const vehicleProfiles: { value: ParkingVehicleProfile; label: string }[] = [
  { value: "city", label: "Petite citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV / Monospace" },
  { value: "utility", label: "Utilitaire" },
  { value: "two_wheels", label: "Moto / Scooter" },
];

const accessTypes: { value: ParkingAccessType; label: string }[] = [
  { value: "badge", label: "Badge / bip" },
  { value: "remote", label: "Télécommande" },
  { value: "key", label: "Clé" },
  { value: "digicode", label: "Digicode" },
  { value: "free", label: "Accès libre" },
];

const securityOptions: { value: ParkingSecurityFeature; label: string }[] = [
  { value: "gate", label: "Portail verrouillé" },
  { value: "camera", label: "Caméra" },
  { value: "guard", label: "Gardien" },
  { value: "residence", label: "Résidence sécurisée" },
  { value: "lighting", label: "Éclairage renforcé" },
];

const surfaceTypes = [
  { value: "beton", label: "Béton" },
  { value: "asphalte", label: "Asphalte" },
  { value: "gravier", label: "Gravier" },
  { value: "autre", label: "Autre" },
];

interface ParkingWizardProps {
  formData: CreatePropertyData;
  onChange: (changes: Partial<CreatePropertyData>) => void;
  parkingDetails: ParkingDetails;
  onParkingDetailsChange: (details: ParkingDetails) => void;
  existingProperties: Property[];
  disabled?: boolean;
  onCancel?: () => void;
  submitLabel: string;
}

const helpLinks: Record<string, string> = {
  depot: "https://docs.gestionlocative.app/parking/depot",
  typeLocation: "https://docs.gestionlocative.app/parking/type-location",
  charges: "https://docs.gestionlocative.app/parking/charges",
};

function HelpBadge({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="ml-2 text-xs font-semibold text-primary underline decoration-dotted hover:no-underline"
    >
      ?
      <span className="sr-only">{title}</span>
    </a>
  );
}

export function ParkingWizard({
  formData,
  onChange,
  parkingDetails,
  onParkingDetailsChange,
  existingProperties,
  disabled,
  onCancel,
  submitLabel,
}: ParkingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const isLastStep = currentStep === DEFAULT_STEPS.length - 1;

  const selectedLinkedProperty = useMemo(() => {
    if (!parkingDetails.linked_property_id) return null;
    return existingProperties.find((p) => p.id === parkingDetails.linked_property_id) ?? null;
  }, [parkingDetails.linked_property_id, existingProperties]);

  const handleLinkedPropertyChange = (propertyId: string | null) => {
    onParkingDetailsChange({
      ...parkingDetails,
      linked_property_id: propertyId,
    });
    if (propertyId) {
      const linked = existingProperties.find((p) => p.id === propertyId);
      if (linked) {
        onChange({
          adresse_complete: linked.adresse_complete,
          code_postal: linked.code_postal,
          ville: linked.ville,
          departement: linked.departement,
        });
      }
    } else {
      onChange({
        adresse_complete: "",
        code_postal: "",
        ville: "",
        departement: "",
      });
    }
  };

  const toggleArrayValue = <T,>(arr: T[], value: T): T[] => {
    if (arr.includes(value)) {
      return arr.filter((item) => item !== value);
    }
    return [...arr, value];
  };

  const renderStepNavigation = () => (
    <div className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm dark:bg-background">
      <div className="grid gap-2 sm:grid-cols-6">
        {DEFAULT_STEPS.map((label, index) => {
          const state =
            index === currentStep ? "current" : index < currentStep ? "done" : "upcoming";
          return (
            <button
              key={label}
              type="button"
              onClick={() => setCurrentStep(index)}
              className="flex flex-col items-start gap-1 text-left"
              disabled={disabled}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                  state === "current"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : state === "done"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <span
                className={`text-xs font-medium ${
                  state === "current"
                    ? "text-foreground"
                    : state === "done"
                    ? "text-muted-foreground"
                    : "text-muted-foreground/70"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderContextStep = () => (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-border/50 dark:bg-background">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Type d’emplacement
              </Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {placementOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onParkingDetailsChange({
                        ...parkingDetails,
                        placement_type: option.value,
                      })
                    }
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition hover:-translate-y-0.5 ${
                      parkingDetails.placement_type === option.value
                        ? "border-primary bg-primary/5 text-primary shadow-primary/10"
                        : "border-border bg-muted/40 hover:border-primary/40"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Rattachement
              </Label>
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <select
                  value={parkingDetails.linked_property_id ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    handleLinkedPropertyChange(event.target.value ? event.target.value : null)
                  }
                  className="flex h-11 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-inner"
                >
                  <option value="">Indépendant</option>
                  {existingProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.adresse_complete} ({property.type})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl border-dashed"
                  onClick={() => handleLinkedPropertyChange(null)}
                  disabled={disabled || !parkingDetails.linked_property_id}
                >
                  Détacher
                </Button>
              </div>
            </div>

            {!selectedLinkedProperty && (
              <div className="grid gap-4 md:grid-cols-2">
                <FloatingField
                  label="Adresse complète"
                  value={formData.adresse_complete}
                  onChange={(value) => onChange({ adresse_complete: value })}
                  placeholder="1 route du phare"
                  disabled={disabled}
                />
                <FloatingField
                  label="Code postal"
                  value={formData.code_postal}
                  onChange={(value) => onChange({ code_postal: value })}
                  maxLength={5}
                  disabled={disabled}
                />
                <FloatingField
                  label="Ville"
                  value={formData.ville}
                  onChange={(value) => onChange({ ville: value })}
                  disabled={disabled}
                />
                <FloatingField
                  label="Département"
                  value={formData.departement}
                  onChange={(value) => onChange({ departement: value })}
                  maxLength={2}
                  disabled={disabled}
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <FloatingField
                label="Numéro / repère d’emplacement"
                value={parkingDetails.reference_label ?? ""}
                onChange={(value) =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    reference_label: value,
                  })
                }
                placeholder="Ex : Place B12, colonne 3"
                disabled={disabled}
              />
              <FloatingField
                label="Niveau / étage"
                value={parkingDetails.level ?? ""}
                onChange={(value) =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    level: value,
                  })
                }
                placeholder="Sous-sol -2, RDC…"
                disabled={disabled}
              />
            </div>
          </div>
          <aside className="rounded-2xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Conseils</p>
            <ul className="mt-3 list-disc space-y-1 pl-4">
              <li>Précisez l’information la plus utile pour guider le locataire jusqu’à la place.</li>
              <li>Si le parking est joint à un logement, rattachez-le pour reprendre l’adresse.</li>
              <li>Pour les parkings de copropriété, utilisez la même nomenclature que sur le plan.</li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );

  const renderCharacteristicsStep = () => (
    <section className="space-y-8 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-border/50 dark:bg-background">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Gabarit compatible
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {vehicleProfiles.map((profile) => (
              <button
                key={profile.value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    vehicle_profile: profile.value,
                  })
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 ${
                  parkingDetails.vehicle_profile === profile.value
                    ? "border-primary bg-primary/5 text-primary shadow-primary/10"
                    : "border-border bg-muted/30 hover:border-primary/40"
                }`}
              >
                {profile.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Type de sol / environnement
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {surfaceTypes.map((surface) => (
              <button
                key={surface.value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    surface_type: surface.value as ParkingDetails["surface_type"],
                  })
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                  parkingDetails.surface_type === surface.value
                    ? "border-primary bg-primary/5 text-primary shadow-primary/10"
                    : "border-border bg-muted/30 hover:border-primary/40"
                }`}
              >
                {surface.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">
          Dimensions précises (optionnelles)
        </summary>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FloatingField
            label="Longueur (m)"
            type="number"
            value={parkingDetails.dimensions?.length ?? ""}
            onChange={(value) =>
              onParkingDetailsChange({
                ...parkingDetails,
                dimensions: { ...parkingDetails.dimensions, length: value ? Number(value) : null },
              })
            }
            disabled={disabled}
          />
          <FloatingField
            label="Largeur (m)"
            type="number"
            value={parkingDetails.dimensions?.width ?? ""}
            onChange={(value) =>
              onParkingDetailsChange({
                ...parkingDetails,
                dimensions: { ...parkingDetails.dimensions, width: value ? Number(value) : null },
              })
            }
            disabled={disabled}
          />
          <FloatingField
            label="Hauteur max (m)"
            type="number"
            value={parkingDetails.dimensions?.height ?? ""}
            onChange={(value) =>
              onParkingDetailsChange({
                ...parkingDetails,
                dimensions: { ...parkingDetails.dimensions, height: value ? Number(value) : null },
              })
            }
            disabled={disabled}
          />
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Manœuvre & accès véhicule
          </Label>
          <div className="mt-3 space-y-3 text-sm">
            <ToggleCheckbox
              label="Rampe étroite"
              checked={parkingDetails.manoeuvre.narrow_ramp}
              onChange={(checked) =>
                onParkingDetailsChange({
                  ...parkingDetails,
                  manoeuvre: { ...parkingDetails.manoeuvre, narrow_ramp: checked },
                })
              }
              disabled={disabled}
            />
            <ToggleCheckbox
              label="Virage serré"
              checked={parkingDetails.manoeuvre.sharp_turn}
              onChange={(checked) =>
                onParkingDetailsChange({
                  ...parkingDetails,
                  manoeuvre: { ...parkingDetails.manoeuvre, sharp_turn: checked },
                })
              }
              disabled={disabled}
            />
            <ToggleCheckbox
              label="Convient aux grands véhicules"
              checked={parkingDetails.manoeuvre.suitable_large_vehicle}
              onChange={(checked) =>
                onParkingDetailsChange({
                  ...parkingDetails,
                  manoeuvre: { ...parkingDetails.manoeuvre, suitable_large_vehicle: checked },
                })
              }
              disabled={disabled}
            />
          </div>
        </div>
        <aside className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Tips voyageurs</p>
          <p className="mt-2">
            Indiquez si un SUV ou un utilitaire peut manœuvrer, et si des virages serrés limitent la
            marche arrière. Cette section aide à éviter les litiges à l’arrivée.
          </p>
        </aside>
      </div>
    </section>
  );

  const renderAccessStep = () => (
    <section className="space-y-8 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-border/50 dark:bg-background">
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Type d’accès
          </Label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {accessTypes.map((access) => (
              <ToggleCheckbox
                key={access.value}
                label={access.label}
                checked={parkingDetails.access_types.includes(access.value)}
                onChange={() =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    access_types: toggleArrayValue(parkingDetails.access_types, access.value),
                  })
                }
                disabled={disabled}
              />
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Horaires d’accès
          </Label>
          <div className="mt-3 flex flex-wrap gap-3">
            {["24_7", "limited"].map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                  parkingDetails.access_window.mode === mode
                    ? "border-primary bg-primary/5 text-primary shadow-primary/10"
                    : "border-border bg-muted/40 hover:border-primary/40"
                }`}
                onClick={() =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    access_window: {
                      ...parkingDetails.access_window,
                      mode: mode as "24_7" | "limited",
                      open_at: mode === "24_7" ? null : parkingDetails.access_window.open_at,
                      close_at: mode === "24_7" ? null : parkingDetails.access_window.close_at,
                    },
                  })
                }
                disabled={disabled}
              >
                {mode === "24_7" ? "24h/24" : "Horaires limités"}
              </button>
            ))}
          </div>
          {parkingDetails.access_window.mode === "limited" && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FloatingField
                label="Ouverture"
                type="time"
                value={parkingDetails.access_window.open_at ?? ""}
                onChange={(value) =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    access_window: {
                      ...parkingDetails.access_window,
                      open_at: value,
                    },
                  })
                }
                disabled={disabled}
              />
              <FloatingField
                label="Fermeture"
                type="time"
                value={parkingDetails.access_window.close_at ?? ""}
                onChange={(value) =>
                  onParkingDetailsChange({
                    ...parkingDetails,
                    access_window: {
                      ...parkingDetails.access_window,
                      close_at: value,
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Sécurisation
        </Label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {securityOptions.map((option) => (
            <ToggleCheckbox
              key={option.value}
              label={option.label}
              checked={parkingDetails.security_features.includes(option.value)}
              onChange={() =>
                onParkingDetailsChange({
                  ...parkingDetails,
                  security_features: toggleArrayValue(
                    parkingDetails.security_features,
                    option.value
                  ),
                })
              }
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </section>
  );

  const renderRentStep = () => (
    <section className="space-y-8 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-border/50 dark:bg-background">
      <div className="grid gap-4 md:grid-cols-3">
        <FloatingField
          label="Loyer mensuel"
          type="number"
          value={formData.loyer_base}
          onChange={(value) => onChange({ loyer_base: Number(value || 0) })}
          disabled={disabled}
        />
        <div className="relative">
          <FloatingField
            label="Charges (optionnel)"
            type="number"
            value={formData.charges_mensuelles}
            onChange={(value) => onChange({ charges_mensuelles: Number(value || 0) })}
            disabled={disabled}
          />
          <HelpBadge href={helpLinks.charges} title="Comprendre les charges parking" />
        </div>
        <div className="relative">
          <FloatingField
            label="Dépôt de garantie"
            type="number"
            value={formData.depot_garantie}
            onChange={(value) => onChange({ depot_garantie: Number(value || 0) })}
            disabled={disabled}
          />
          <HelpBadge href={helpLinks.depot} title="Bonnes pratiques dépôt parking" />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/30 p-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Type de location
          </Label>
          <HelpBadge href={helpLinks.typeLocation} title="Différences parking seul / accessoire" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
              parkingDetails.extra_badge_fees === null
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-white"
            }`}
            onClick={() =>
              onParkingDetailsChange({
                ...parkingDetails,
                extra_badge_fees: null,
              })
            }
            disabled={disabled}
          >
            Parking seul (contrat indépendant)
          </button>
          <button
            type="button"
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
              parkingDetails.extra_badge_fees !== null
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-white"
            }`}
            onClick={() =>
              onParkingDetailsChange({
                ...parkingDetails,
                extra_badge_fees: parkingDetails.extra_badge_fees ?? 0,
              })
            }
            disabled={disabled}
          >
            Accessoire à un logement (badge refacturé)
          </button>
        </div>
        {parkingDetails.extra_badge_fees !== null && (
          <FloatingField
            label="Frais badge / bip (optionnel)"
            type="number"
            value={parkingDetails.extra_badge_fees ?? ""}
            onChange={(value) =>
              onParkingDetailsChange({
                ...parkingDetails,
                extra_badge_fees: value ? Number(value) : 0,
              })
            }
            disabled={disabled}
          />
        )}
      </div>
    </section>
  );

  const renderPhotosStep = () => (
    <section className="rounded-2xl border border-dashed border-border/60 bg-muted/40 p-6 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">Photos recommandées</p>
      <p className="mt-1">
        Ajoutez ces photos dans “Médias du logement” après la création pour rassurer les candidats :
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>Vue globale de la place / du box</li>
        <li>Portail d’accès, badge ou digicode</li>
        <li>Rampe, virage ou circulation qui nécessite une précision</li>
      </ul>
      <p className="mt-3 text-xs">
        Astuce : prenez les photos depuis l’entrée, en pleine lumière, pour que l’échelle soit
        clairement visible.
      </p>
    </section>
  );

  const renderSummaryStep = () => (
    <section className="space-y-4 rounded-2xl border border-border/60 bg-white/70 p-6 shadow-sm">
      <p className="text-lg font-semibold">Résumé</p>
      <div className="grid gap-4 md:grid-cols-2">
        <SummaryItem
          label="Emplacement"
          value={
            placementOptions.find((opt) => opt.value === parkingDetails.placement_type)?.label ??
            "—"
          }
        />
        <SummaryItem
          label="Gabarit compatible"
          value={
            vehicleProfiles.find((opt) => opt.value === parkingDetails.vehicle_profile)?.label ?? "—"
          }
        />
        <SummaryItem
          label="Accès"
          value={parkingDetails.access_types
            .map((value) => accessTypes.find((opt) => opt.value === value)?.label ?? value)
            .join(", ")}
        />
        <SummaryItem
          label="Loyer CC"
          value={`${(formData.loyer_base || 0) + (formData.charges_mensuelles || 0)} € / mois`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Vérifiez les sections précédentes si besoin avant de soumettre. Vous pourrez toujours
        sauvegarder en brouillon.
      </p>
    </section>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderContextStep();
      case 1:
        return renderCharacteristicsStep();
      case 2:
        return renderAccessStep();
      case 3:
        return renderRentStep();
      case 4:
        return renderPhotosStep();
      case 5:
        return renderSummaryStep();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 rounded-3xl bg-gradient-to-b from-background via-muted/30 to-background p-4">
      {renderStepNavigation()}
      <div className="rounded-lg border border-border/70 bg-background p-4 shadow-sm">{renderStep()}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
              Annuler
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 0 || disabled}
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
          >
            Étape précédente
          </Button>
        </div>
        <div className="flex gap-2">
          {!isLastStep && (
            <Button
              type="button"
              disabled={disabled}
              onClick={() => setCurrentStep((step) => Math.min(DEFAULT_STEPS.length - 1, step + 1))}
            >
              Étape suivante
            </Button>
          )}
          {isLastStep && (
            <Button type="submit" disabled={disabled}>
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FloatingFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  label: string;
  value: string | number | null;
  onChange: (value: string) => void;
}

function FloatingField({ label, value, onChange, className, ...props }: FloatingFieldProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`peer h-12 rounded-xl border border-input bg-background px-3 pt-4 text-sm shadow-inner focus-visible:ring-2 ${className ?? ""}`}
      />
      <span className="pointer-events-none absolute left-3 top-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

interface ToggleCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleCheckbox({ label, checked, onChange, disabled }: ToggleCheckboxProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-2 text-left text-sm font-medium transition ${
        checked ? "border-primary bg-primary/5 text-primary shadow-primary/10" : "border-border bg-muted/40"
      }`}
    >
      <span>{label}</span>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-sm border text-[11px] ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
        }`}
      >
        {checked && <Check className="h-3 w-3" />}
      </span>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}


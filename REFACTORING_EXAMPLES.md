# Exemples Concrets de Refactorisation SOTA

Ce document fournit des exemples de code détaillés pour refactoriser les fichiers les plus critiques.

---

## 1. PropertyDetailsClient.tsx (1,958 → ~300 lignes)

### Structure Proposée

```
app/owner/properties/[id]/
├── PropertyDetailsClient.tsx       # 300 lignes (orchestration)
├── components/
│   ├── PropertyCharacteristicsBadges.tsx  # ✅ Déjà extrait
│   ├── PropertyEditForm.tsx               # ✅ Déjà extrait
│   ├── PropertyPhotoGallery.tsx           # À créer
│   ├── PropertyLeaseStatus.tsx            # À créer
│   ├── PropertyLocationCard.tsx           # À créer
│   └── PropertyFinancialInfo.tsx          # À créer
├── hooks/
│   ├── usePropertyEdit.ts
│   ├── usePhotoManagement.ts
│   └── usePropertyMutations.ts
└── _data/
    └── fetchPropertyDetails.ts
```

### Exemple: Extraction du hook usePhotoManagement

```typescript
// hooks/usePhotoManagement.ts
import { useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/ui/use-toast";

interface UsePhotoManagementOptions {
  propertyId: string;
  initialPhotos: PropertyPhoto[];
}

export function usePhotoManagement({ propertyId, initialPhotos }: UsePhotoManagementOptions) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState(initialPhotos);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addPhotos = useCallback((files: File[]) => {
    setPendingPhotos(prev => [...prev, ...files]);
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    setDeletedPhotoIds(prev => [...prev, photoId]);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  const removePendingPhoto = useCallback((index: number) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadPendingPhotos = useCallback(async () => {
    if (pendingPhotos.length === 0) return [];

    setIsUploading(true);
    try {
      const uploaded = await Promise.all(
        pendingPhotos.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("propertyId", propertyId);

          const response = await apiClient.post("/api/photos/upload", formData);
          return response.data;
        })
      );

      setPhotos(prev => [...prev, ...uploaded]);
      setPendingPhotos([]);
      return uploaded;
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'uploader les photos",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [pendingPhotos, propertyId, toast]);

  const deleteMarkedPhotos = useCallback(async () => {
    if (deletedPhotoIds.length === 0) return;

    await apiClient.delete("/api/photos/bulk", {
      data: { ids: deletedPhotoIds },
    });
    setDeletedPhotoIds([]);
  }, [deletedPhotoIds]);

  const reset = useCallback(() => {
    setPhotos(initialPhotos);
    setPendingPhotos([]);
    setDeletedPhotoIds([]);
  }, [initialPhotos]);

  return {
    // State
    photos,
    pendingPhotos,
    deletedPhotoIds,
    isUploading,
    hasChanges: pendingPhotos.length > 0 || deletedPhotoIds.length > 0,

    // Actions
    addPhotos,
    removePhoto,
    removePendingPhoto,
    uploadPendingPhotos,
    deleteMarkedPhotos,
    reset,
  };
}
```

### Exemple: Composant PropertyPhotoGallery

```typescript
// components/PropertyPhotoGallery.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";

interface PropertyPhotoGalleryProps {
  photos: PropertyPhoto[];
  pendingPhotos: File[];
  isEditing: boolean;
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (id: string) => void;
  onRemovePendingPhoto: (index: number) => void;
}

export function PropertyPhotoGallery({
  photos,
  pendingPhotos,
  isEditing,
  onAddPhotos,
  onRemovePhoto,
  onRemovePendingPhoto,
}: PropertyPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const allPhotos = [
    ...photos.map(p => ({ type: 'existing' as const, data: p })),
    ...pendingPhotos.map(f => ({ type: 'pending' as const, data: f })),
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onAddPhotos(files);
  };

  return (
    <div className="space-y-4">
      {/* Grid de photos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {allPhotos.map((photo, index) => (
          <PhotoThumbnail
            key={photo.type === 'existing' ? photo.data.id : `pending-${index}`}
            photo={photo}
            index={index}
            isEditing={isEditing}
            onSelect={() => setSelectedIndex(index)}
            onRemove={() => {
              if (photo.type === 'existing') {
                onRemovePhoto(photo.data.id);
              } else {
                onRemovePendingPhoto(index - photos.length);
              }
            }}
          />
        ))}

        {/* Bouton d'ajout */}
        {isEditing && (
          <label className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Plus className="h-8 w-8 text-muted-foreground" />
          </label>
        )}
      </div>

      {/* Modal plein écran */}
      <PhotoLightbox
        photos={allPhotos}
        selectedIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onNavigate={setSelectedIndex}
      />
    </div>
  );
}

// Sous-composants extraits pour clarté
function PhotoThumbnail({ photo, index, isEditing, onSelect, onRemove }) {
  const src = photo.type === 'existing'
    ? photo.data.url
    : URL.createObjectURL(photo.data);

  return (
    <div className="relative aspect-square group">
      <Image
        src={src}
        alt={`Photo ${index + 1}`}
        fill
        className="object-cover rounded-lg cursor-pointer"
        onClick={onSelect}
      />
      {photo.type === 'pending' && (
        <div className="absolute top-2 left-2">
          <Badge variant="secondary">Nouveau</Badge>
        </div>
      )}
      {isEditing && (
        <Button
          size="icon"
          variant="destructive"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function PhotoLightbox({ photos, selectedIndex, onClose, onNavigate }) {
  if (selectedIndex === null) return null;

  const photo = photos[selectedIndex];
  const src = photo.type === 'existing'
    ? photo.data.url
    : URL.createObjectURL(photo.data);

  return (
    <Dialog open={selectedIndex !== null} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <div className="relative w-full h-[80vh]">
          <Image src={src} alt="" fill className="object-contain" />

          {/* Navigation */}
          {selectedIndex > 0 && (
            <Button
              className="absolute left-4 top-1/2 -translate-y-1/2"
              onClick={() => onNavigate(selectedIndex - 1)}
            >
              <ChevronLeft />
            </Button>
          )}
          {selectedIndex < photos.length - 1 && (
            <Button
              className="absolute right-4 top-1/2 -translate-y-1/2"
              onClick={() => onNavigate(selectedIndex + 1)}
            >
              <ChevronRight />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 2. ParkingLeaseWizard (1,751 → ~200 lignes + 6 steps)

### Structure Proposée

```
features/leases/components/parking-lease-wizard/
├── index.tsx                    # 200 lignes (orchestration)
├── WizardProvider.tsx           # Context + state
├── WizardNavigation.tsx         # Navigation UI
├── steps/
│   ├── StepParkingType.tsx      # ~150 lignes
│   ├── StepDetails.tsx          # ~200 lignes
│   ├── StepConditions.tsx       # ~180 lignes
│   ├── StepFinancial.tsx        # ~150 lignes
│   ├── StepParties.tsx          # ~150 lignes
│   └── StepPreview.tsx          # ~200 lignes
├── constants/
│   ├── vehicleTypes.ts
│   ├── accessMethods.ts
│   └── securityFeatures.ts
└── types.ts
```

### Exemple: WizardProvider avec Context

```typescript
// WizardProvider.tsx
"use client";

import { createContext, useContext, useReducer, useCallback, ReactNode } from "react";
import type { ParkingCategory, VehicleType, ParkingLeaseConditions, ParkingSpecifications } from "./types";

// Types
interface WizardState {
  currentStep: number;
  category: ParkingCategory | null;
  vehicleType: VehicleType;
  specifications: Partial<ParkingSpecifications>;
  conditions: Partial<ParkingLeaseConditions>;
  owner: Record<string, any>;
  tenant: Record<string, any>;
  specialClauses: string[];
  isGenerating: boolean;
}

type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "SET_CATEGORY"; category: ParkingCategory }
  | { type: "SET_VEHICLE_TYPE"; vehicleType: VehicleType }
  | { type: "UPDATE_SPECIFICATIONS"; specifications: Partial<ParkingSpecifications> }
  | { type: "UPDATE_CONDITIONS"; conditions: Partial<ParkingLeaseConditions> }
  | { type: "SET_OWNER"; owner: Record<string, any> }
  | { type: "SET_TENANT"; tenant: Record<string, any> }
  | { type: "ADD_CLAUSE"; clause: string }
  | { type: "REMOVE_CLAUSE"; index: number }
  | { type: "SET_GENERATING"; isGenerating: boolean }
  | { type: "RESET" };

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;

  // Convenience methods
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canProceed: () => boolean;
  getProgress: () => number;
}

// Initial state
const initialState: WizardState = {
  currentStep: 0,
  category: null,
  vehicleType: "voiture_berline",
  specifications: {
    features: {
      couvert: false,
      ferme: false,
      eclaire: true,
      prise_electrique: false,
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
      deposit: 80,
      depositMonths: 1,
    },
  },
  owner: {},
  tenant: {},
  specialClauses: [],
  isGenerating: false,
};

// Reducer
function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "NEXT_STEP":
      return { ...state, currentStep: Math.min(state.currentStep + 1, 5) };
    case "PREV_STEP":
      return { ...state, currentStep: Math.max(state.currentStep - 1, 0) };
    case "SET_CATEGORY":
      return { ...state, category: action.category };
    case "SET_VEHICLE_TYPE":
      return { ...state, vehicleType: action.vehicleType };
    case "UPDATE_SPECIFICATIONS":
      return { ...state, specifications: { ...state.specifications, ...action.specifications } };
    case "UPDATE_CONDITIONS":
      return { ...state, conditions: { ...state.conditions, ...action.conditions } };
    case "SET_OWNER":
      return { ...state, owner: action.owner };
    case "SET_TENANT":
      return { ...state, tenant: action.tenant };
    case "ADD_CLAUSE":
      return { ...state, specialClauses: [...state.specialClauses, action.clause] };
    case "REMOVE_CLAUSE":
      return { ...state, specialClauses: state.specialClauses.filter((_, i) => i !== action.index) };
    case "SET_GENERATING":
      return { ...state, isGenerating: action.isGenerating };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// Context
const WizardContext = createContext<WizardContextValue | null>(null);

// Provider
export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  const goToStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", step });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: "NEXT_STEP" });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: "PREV_STEP" });
  }, []);

  const canProceed = useCallback(() => {
    switch (state.currentStep) {
      case 0: return state.category !== null;
      case 1: return state.specifications.location?.numero !== undefined;
      case 2: return state.conditions.duration?.startDate !== undefined;
      case 3: return (state.conditions.financial?.rentMonthly ?? 0) > 0;
      case 4: return Object.keys(state.owner).length > 0 && Object.keys(state.tenant).length > 0;
      default: return true;
    }
  }, [state]);

  const getProgress = useCallback(() => {
    return ((state.currentStep + 1) / 6) * 100;
  }, [state.currentStep]);

  return (
    <WizardContext.Provider value={{ state, dispatch, goToStep, nextStep, prevStep, canProceed, getProgress }}>
      {children}
    </WizardContext.Provider>
  );
}

// Hook
export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within WizardProvider");
  }
  return context;
}
```

### Exemple: Step Component Simplifié

```typescript
// steps/StepParkingType.tsx
"use client";

import { motion } from "framer-motion";
import { Car, Lock, Zap, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useWizard } from "../WizardProvider";
import { PARKING_PRESETS, type ParkingCategory } from "../types";

const CATEGORY_OPTIONS: { value: ParkingCategory; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "place_exterieure", label: "Place extérieure", description: "Parking à ciel ouvert", icon: <Car /> },
  { value: "place_couverte", label: "Place couverte", description: "Parking couvert", icon: <Shield /> },
  { value: "box_ferme", label: "Box fermé", description: "Garage individuel", icon: <Lock /> },
  { value: "garage_prive", label: "Garage privé", description: "Avec borne de recharge", icon: <Zap /> },
];

export function StepParkingType() {
  const { state, dispatch } = useWizard();

  const handleSelect = (value: ParkingCategory) => {
    dispatch({ type: "SET_CATEGORY", category: value });

    // Auto-configure specs based on category
    const preset = PARKING_PRESETS[value];
    if (preset) {
      dispatch({ type: "UPDATE_SPECIFICATIONS", specifications: preset.specifications });
      dispatch({ type: "UPDATE_CONDITIONS", conditions: preset.conditions });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">Type de parking</h2>
        <p className="text-muted-foreground mt-2">
          Sélectionnez le type d'emplacement à louer
        </p>
      </div>

      <RadioGroup
        value={state.category || ""}
        onValueChange={(value) => handleSelect(value as ParkingCategory)}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {CATEGORY_OPTIONS.map((option) => (
          <Label key={option.value} htmlFor={option.value} className="cursor-pointer">
            <Card className={cn(
              "transition-all hover:border-primary",
              state.category === option.value && "border-primary ring-2 ring-primary/20"
            )}>
              <CardContent className="flex items-center gap-4 p-4">
                <RadioGroupItem value={option.value} id={option.value} className="sr-only" />
                <div className="p-3 rounded-full bg-primary/10">
                  {option.icon}
                </div>
                <div>
                  <p className="font-semibold">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </CardContent>
            </Card>
          </Label>
        ))}
      </RadioGroup>
    </motion.div>
  );
}
```

---

## 3. process-outbox - Strategy Pattern

### Structure Proposée

```
supabase/functions/process-outbox/
├── index.ts                     # ~100 lignes (entry point)
├── event-processor.ts           # ~50 lignes (router)
├── handlers/
│   ├── index.ts                 # Export all handlers
│   ├── base-handler.ts          # Abstract base class
│   ├── lease-handlers.ts        # Lease events
│   ├── payment-handlers.ts      # Payment events
│   ├── notification-handlers.ts # Notification events
│   ├── invoice-handlers.ts      # Invoice events
│   └── visit-handlers.ts        # Visit events
├── services/
│   ├── notification.service.ts
│   ├── email.service.ts
│   └── invoice.service.ts
└── templates/
    ├── email-builder.ts
    └── email-templates/
        ├── signature-request.ts
        ├── payment-reminder.ts
        └── welcome.ts
```

### Exemple: Handler Base + Implementation

```typescript
// handlers/base-handler.ts
export abstract class EventHandler<T = unknown> {
  abstract eventType: string;
  abstract execute(payload: T): Promise<void>;

  protected async sendNotification(userId: string, notification: NotificationData) {
    // Shared notification logic
  }

  protected async sendEmail(to: string, template: EmailTemplate) {
    // Shared email logic
  }
}

// handlers/lease-handlers.ts
import { EventHandler } from "./base-handler";
import { EmailBuilder } from "../templates/email-builder";

export class LeaseSignedHandler extends EventHandler<LeaseSignedPayload> {
  eventType = "lease_signed";

  async execute(payload: LeaseSignedPayload) {
    const { leaseId, tenantId, ownerId } = payload;

    // Get lease details
    const lease = await this.getLease(leaseId);
    const tenant = await this.getUser(tenantId);
    const owner = await this.getUser(ownerId);

    // Send notifications
    await Promise.all([
      this.sendNotification(tenantId, {
        title: "Bail signé",
        message: `Votre bail pour ${lease.property.address} a été signé.`,
        type: "success",
      }),
      this.sendNotification(ownerId, {
        title: "Bail signé",
        message: `${tenant.name} a signé le bail.`,
        type: "success",
      }),
    ]);

    // Send confirmation emails
    const email = new EmailBuilder()
      .setSubject("Confirmation de signature")
      .addHeader("Bail signé avec succès")
      .addBody(`Le bail pour ${lease.property.address} est maintenant actif.`)
      .addButton("Voir le bail", `${BASE_URL}/leases/${leaseId}`)
      .build();

    await this.sendEmail(tenant.email, email);
  }
}

export class PaymentReceivedHandler extends EventHandler<PaymentReceivedPayload> {
  eventType = "payment_received";

  async execute(payload: PaymentReceivedPayload) {
    // Similar pattern...
  }
}

// handlers/index.ts
export const handlers: Record<string, EventHandler> = {
  lease_signed: new LeaseSignedHandler(),
  lease_terminated: new LeaseTerminatedHandler(),
  payment_received: new PaymentReceivedHandler(),
  payment_overdue: new PaymentOverdueHandler(),
  // ... etc
};

// event-processor.ts
import { handlers } from "./handlers";

export async function processEvent(event: OutboxEvent) {
  const handler = handlers[event.type];

  if (!handler) {
    console.warn(`No handler for event type: ${event.type}`);
    return;
  }

  try {
    await handler.execute(event.payload);
  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);
    throw error;
  }
}

// index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { processEvent } from "./event-processor";

serve(async (req) => {
  const events = await getUnprocessedEvents();

  for (const event of events) {
    await processEvent(event);
    await markEventProcessed(event.id);
  }

  return new Response(JSON.stringify({ processed: events.length }));
});
```

---

## 4. Email Template Builder

```typescript
// templates/email-builder.ts
type EmailSection =
  | { type: "header"; title: string }
  | { type: "body"; content: string }
  | { type: "button"; label: string; url: string }
  | { type: "divider" }
  | { type: "footer" };

export class EmailBuilder {
  private subject = "";
  private sections: EmailSection[] = [];

  setSubject(subject: string): this {
    this.subject = subject;
    return this;
  }

  addHeader(title: string): this {
    this.sections.push({ type: "header", title });
    return this;
  }

  addBody(content: string): this {
    this.sections.push({ type: "body", content });
    return this;
  }

  addButton(label: string, url: string): this {
    this.sections.push({ type: "button", label, url });
    return this;
  }

  addDivider(): this {
    this.sections.push({ type: "divider" });
    return this;
  }

  addFooter(): this {
    this.sections.push({ type: "footer" });
    return this;
  }

  build(): { subject: string; html: string; text: string } {
    return {
      subject: this.subject,
      html: this.buildHtml(),
      text: this.buildText(),
    };
  }

  private buildHtml(): string {
    const content = this.sections.map(section => {
      switch (section.type) {
        case "header":
          return `<h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">${section.title}</h1>`;
        case "body":
          return `<p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">${section.content}</p>`;
        case "button":
          return `
            <a href="${section.url}"
               style="display: inline-block; background: #2563eb; color: white;
                      padding: 12px 24px; border-radius: 8px; text-decoration: none;
                      font-weight: 600; margin: 16px 0;">
              ${section.label}
            </a>`;
        case "divider":
          return `<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />`;
        case "footer":
          return `
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
              <p style="color: #9a9a9a; font-size: 12px;">
                Cet email a été envoyé par TALOK.
                <a href="${BASE_URL}/settings/notifications">Gérer vos préférences</a>
              </p>
            </div>`;
        default:
          return "";
      }
    }).join("\n");

    return `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${content}
        </body>
      </html>
    `;
  }

  private buildText(): string {
    return this.sections.map(section => {
      switch (section.type) {
        case "header": return `# ${section.title}\n`;
        case "body": return `${section.content}\n`;
        case "button": return `${section.label}: ${section.url}\n`;
        case "divider": return `---\n`;
        case "footer": return `\n--\nEnvoyé par TALOK`;
        default: return "";
      }
    }).join("\n");
  }
}
```

---

## Conclusion

Ces exemples montrent comment transformer des fichiers monolithiques de 1500+ lignes en architectures modulaires et maintenables. Les patterns clés sont:

1. **Extraction de hooks** pour la logique métier
2. **Compound Components** pour les wizards
3. **Strategy Pattern** pour le routing d'événements
4. **Builder Pattern** pour les templates email
5. **Context + Reducer** pour le state management complexe

Chaque refactorisation conserve la fonctionnalité existante tout en améliorant:
- La testabilité (composants isolés)
- La lisibilité (fichiers de 100-200 lignes max)
- La réutilisabilité (hooks et composants partagés)
- La maintenabilité (responsabilités séparées)

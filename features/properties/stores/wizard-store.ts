import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { propertiesService, type RoomPayload } from '../services/properties.service';
import { toast } from '@/components/ui/use-toast';
import type { Property, Room, Photo } from '@/lib/types';
import type { PropertyTypeV3 } from '@/lib/types/property-v3';
import type { BuildingUnit } from '@/lib/types/building-v3';

// SOTA 2026: Toast notification helper for sync errors
function showSyncErrorToast(message: string) {
  toast({
    variant: "destructive",
    title: "Erreur de synchronisation",
    description: message,
  });
}

// ============================================
// SOTA 2026: TYPES SÉCURISÉS
// ============================================

export type WizardStep =
  | 'type_bien'
  | 'address'
  | 'details'
  | 'rooms'
  | 'photos'
  | 'features'
  | 'publish'
  | 'recap'
  | 'building_config';

export type WizardMode = 'fast' | 'full';
type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * SOTA 2026: Interface typée pour les données du formulaire
 * Remplace le `Record<string, any>` non sécurisé
 */
export interface WizardFormData {
  // Type de bien
  type?: PropertyTypeV3;
  type_bien?: PropertyTypeV3;

  // Adresse
  adresse_complete?: string;
  complement_adresse?: string;
  code_postal?: string;
  ville?: string;
  departement?: string;
  latitude?: number;
  longitude?: number;

  // Surfaces
  surface?: number;
  surface_habitable_m2?: number;
  surface_terrain?: number;

  // Configuration
  nb_pieces?: number;
  nb_chambres?: number;
  etage?: number;
  ascenseur?: boolean;
  meuble?: boolean;

  // Financier
  loyer_hc?: number;
  loyer_base?: number;
  charges_mensuelles?: number;
  depot_garantie?: number;

  // DPE
  dpe_classe_energie?: string;
  dpe_classe_climat?: string;
  dpe_consommation?: number;
  dpe_emissions?: number;

  // Chauffage
  chauffage_type?: 'individuel' | 'collectif' | 'aucun';
  chauffage_energie?: 'electricite' | 'gaz' | 'fioul' | 'bois' | 'reseau_urbain' | 'autre';
  eau_chaude_type?: 'electrique_indiv' | 'gaz_indiv' | 'collectif' | 'solaire' | 'autre';

  // Climatisation
  clim_presence?: 'aucune' | 'fixe' | 'mobile';
  clim_type?: 'split' | 'gainable';

  // Équipements
  equipments?: string[];

  // Parking
  parking_type?: string;
  parking_acces?: string[];

  // Caractéristiques
  has_balcon?: boolean;
  has_terrasse?: boolean;
  has_jardin?: boolean;
  has_cave?: boolean;

  // Publication
  visibility?: 'public' | 'private';
  available_from?: string;
  etat?: 'draft' | 'published' | 'archived';

  // Médias
  visite_virtuelle_url?: string;
  description?: string;

  // Usage
  usage_principal?: 'habitation' | 'habitation_secondaire' | 'mixte';

  // SOTA 2026 - Champs spécifiques immeuble
  building_floors?: number;
  building_units?: BuildingUnit[];
  building_name?: string;
  construction_year?: number;
  surface_totale?: number;
  ownership_type?: 'full' | 'partial';
  total_lots_in_building?: number;
  has_ascenseur?: boolean;
  has_gardien?: boolean;
  has_interphone?: boolean;
  has_digicode?: boolean;
  has_local_velo?: boolean;
  has_local_poubelles?: boolean;
  has_parking_commun?: boolean;
  has_jardin_commun?: boolean;
  digicode?: string;
  interphone?: string;
}

interface WizardState {
  // État Global
  propertyId: string | null;
  buildingId: string | null;
  currentStep: WizardStep;
  mode: WizardMode;
  syncStatus: SyncStatus;
  lastError: string | null;

  // SOTA 2026: Flag pour mutex sur initializeDraft
  isInitializing: boolean;

  // Données typées
  formData: WizardFormData;
  rooms: Room[];
  photos: Photo[];

  // Photos à importer depuis scraping
  pendingPhotoUrls: string[];
  photoImportStatus: 'idle' | 'importing' | 'done' | 'error';
  photoImportProgress: { imported: number; total: number };

  // SOTA 2026: Undo/Redo History
  history: WizardFormData[];
  historyIndex: number;
  maxHistoryLength: number;

  // Actions
  reset: () => void;
  initializeDraft: (type: PropertyTypeV3) => Promise<void>;
  loadProperty: (id: string) => Promise<void>;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  addRoom: (room: Partial<Room>) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
  removeRoom: (id: string) => void;
  setPhotos: (photos: Photo[]) => void;

  // Import photos
  setPendingPhotoUrls: (urls: string[]) => void;
  importPendingPhotos: () => Promise<void>;

  // Navigation
  setStep: (step: WizardStep) => void;
  setMode: (mode: WizardMode) => void;
  nextStep: () => void;
  prevStep: () => void;

  // SOTA 2026: Undo/Redo Actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

// Mapping des étapes (ordre logique)
const STEPS_ORDER: WizardStep[] = ['type_bien', 'address', 'details', 'rooms', 'photos', 'features', 'publish', 'recap'];

// Étapes pour le mode FAST
const FAST_STEPS: WizardStep[] = ['type_bien', 'address', 'photos', 'recap'];

// SOTA 2026 - Étapes spécifiques pour les immeubles
const BUILDING_STEPS: WizardStep[] = ['type_bien', 'address', 'building_config', 'photos', 'recap'];

// Types de biens qui n'ont PAS d'étape "rooms" (pas de pièces à configurer)
// ⚠️ Aligné avec TypeStep.tsx : utiliser les vrais IDs (local_commercial, bureaux, etc.)
const TYPES_WITHOUT_ROOMS_STEP = [
  "parking", 
  "box", 
  "local_commercial", 
  "bureaux", 
  "entrepot", 
  "fonds_de_commerce",
  "immeuble"  // SOTA 2026 - Les immeubles ont leur propre étape building_config
];

// Fonction pour obtenir les étapes applicables selon le type de bien et le mode
function getApplicableSteps(propertyType: string | undefined, mode: WizardMode): WizardStep[] {
  // SOTA 2026 - Flux spécifique pour les immeubles
  if (propertyType === 'immeuble') {
    return BUILDING_STEPS;
  }
  
  let steps = mode === 'fast' ? FAST_STEPS : STEPS_ORDER;
  
  if (propertyType && TYPES_WITHOUT_ROOMS_STEP.includes(propertyType)) {
    return steps.filter(step => step !== 'rooms');
  }
  return steps;
}

// Types de pièces principales (comptées dans nb_pieces)
const MAIN_ROOM_TYPES = [
  "chambre", "sejour", "bureau", "salon_cuisine", "salon_sam", 
  "open_space", "suite_parentale", "mezzanine"
];

// Types de chambres (comptées dans nb_chambres)
const BEDROOM_TYPES = ["chambre", "suite_parentale", "suite_enfant"];

// Fonction pour calculer nb_pieces et nb_chambres depuis les rooms
function calculateRoomCounts(rooms: Room[]): { nb_pieces: number; nb_chambres: number } {
  const nb_pieces = rooms.filter(r => MAIN_ROOM_TYPES.includes(r.type_piece)).length;
  const nb_chambres = rooms.filter(r => BEDROOM_TYPES.includes(r.type_piece)).length;
  return { nb_pieces, nb_chambres };
}

// SOTA 2026: État initial typé pour le reset
const INITIAL_STATE: Omit<WizardState, 'reset' | 'initializeDraft' | 'loadProperty' | 'updateFormData' | 'addRoom' | 'updateRoom' | 'removeRoom' | 'setPhotos' | 'setPendingPhotoUrls' | 'importPendingPhotos' | 'setStep' | 'setMode' | 'nextStep' | 'prevStep' | 'undo' | 'redo' | 'canUndo' | 'canRedo' | 'clearHistory'> = {
  propertyId: null,
  buildingId: null,
  currentStep: 'type_bien',
  mode: 'full',
  syncStatus: 'idle',
  lastError: null,
  isInitializing: false,
  formData: {
    etat: 'draft',
    // Valeurs par défaut immeuble
    building_floors: 4,
    building_units: [],
    ownership_type: 'full',
    has_ascenseur: false,
    has_gardien: false,
    has_interphone: false,
    has_digicode: false,
    has_local_velo: false,
    has_local_poubelles: false,
    has_parking_commun: false,
    has_jardin_commun: false,
    digicode: "",
    interphone: "",
  },
  rooms: [],
  photos: [],
  pendingPhotoUrls: [],
  photoImportStatus: 'idle',
  photoImportProgress: { imported: 0, total: 0 },
  // SOTA 2026: Undo/Redo
  history: [],
  historyIndex: -1,
  maxHistoryLength: 50, // Max 50 états dans l'historique
};

// Compteur pour générer des IDs temporaires uniques (évite les doublons avec Date.now())
let tempIdCounter = 0;
function generateTempId(): string {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

// SOTA 2026: Debounce pour updateFormData - évite les appels API excessifs
const UPDATE_DEBOUNCE_MS = 500;

// SOTA 2026: Debounce state par propertyId pour éviter les conflits entre instances
const debounceState = new Map<string, {
  timer: ReturnType<typeof setTimeout> | null;
  pendingUpdates: Partial<WizardFormData>;
}>();

function getDebounceState(propertyId: string) {
  if (!debounceState.has(propertyId)) {
    debounceState.set(propertyId, { timer: null, pendingUpdates: {} });
  }
  return debounceState.get(propertyId)!;
}

function clearDebounceState(propertyId: string) {
  const state = debounceState.get(propertyId);
  if (state?.timer) {
    clearTimeout(state.timer);
  }
  debounceState.delete(propertyId);
}

export const usePropertyWizardStore = create<WizardState>()(
  devtools(
  persist(
    (set, get) => ({
  ...INITIAL_STATE,

  // --- ACTIONS ---

  // Réinitialise complètement le wizard pour une nouvelle création
  reset: () => {
    console.info('[WizardStore] Reset du wizard');
    // Clear tous les debounce timers
    const { propertyId } = get();
    if (propertyId) {
      clearDebounceState(propertyId);
    }
    set(INITIAL_STATE);
  },

  // SOTA 2026: initializeDraft avec MUTEX pour éviter les double-créations
  initializeDraft: async (type) => {
    const { isInitializing, propertyId } = get();

    // MUTEX: Si déjà en cours d'initialisation, ignorer
    if (isInitializing) {
      console.warn('[WizardStore] initializeDraft ignoré - déjà en cours');
      return;
    }

    // Si un propertyId existe déjà, ne pas recréer
    if (propertyId) {
      console.info('[WizardStore] PropertyId existant, mise à jour du type uniquement');
      set((state) => ({
        formData: { ...state.formData, type_bien: type, type }
      }));
      return;
    }

    // Activer le mutex
    set({ isInitializing: true, syncStatus: 'saving', lastError: null });

    try {
      const { propertyId: newPropertyId } = await propertiesService.createDraftPropertyInit(type);

      if (!newPropertyId) {
        throw new Error('Aucun propertyId retourné par le serveur');
      }

      set({
        propertyId: newPropertyId,
        formData: { ...get().formData, type_bien: type, type },
        syncStatus: 'saved',
        isInitializing: false
      });

      console.info(`[WizardStore] Draft créé avec succès: ${newPropertyId}`);
    } catch (error: unknown) {
      console.error('[WizardStore] Erreur création draft:', error);

      // Détecter erreur de limite d'abonnement (403 SUBSCRIPTION_LIMIT)
      const errorData = (error as { data?: { error?: string; message?: string } })?.data;
      const isSubscriptionLimit = errorData?.error === "SUBSCRIPTION_LIMIT"
        || (error instanceof Error && error.message === "SUBSCRIPTION_LIMIT");

      if (isSubscriptionLimit) {
        const limitMessage = errorData?.message
          || "Limite de biens atteinte pour votre forfait. Passez à un forfait supérieur.";
        set({
          syncStatus: 'error',
          lastError: limitMessage,
          isInitializing: false
        });
        toast({
          variant: "destructive",
          title: "Limite atteinte",
          description: limitMessage,
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Erreur lors de la création du brouillon";
      set({
        syncStatus: 'error',
        lastError: errorMessage,
        isInitializing: false
      });
      showSyncErrorToast(errorMessage);
    }
  },

  loadProperty: async (id) => {
    set({ syncStatus: 'saving', lastError: null });
    try {
      const [property, rooms, photos] = await Promise.all([
        propertiesService.getPropertyById(id),
        propertiesService.listRooms(id),
        propertiesService.listPhotos(id)
      ]);

      let buildingId: string | null = null;
      let buildingFormData: Partial<WizardFormData> = {};

      // Charger les données building/units si c'est un immeuble
      if ((property as any).type === 'immeuble') {
        const buildingData = await propertiesService.getBuildingForProperty(id);
        if (buildingData?.building) {
          buildingId = buildingData.building.id;
          buildingFormData = {
            building_floors: buildingData.building.floors ?? 4,
            building_name: buildingData.building.name ?? undefined,
            construction_year: (buildingData.building as any).construction_year ?? undefined,
            surface_totale: (buildingData.building as any).surface_totale ?? undefined,
            ownership_type: (buildingData.building as any).ownership_type ?? 'full',
            total_lots_in_building:
              (buildingData.building as any).total_lots_in_building ?? undefined,
            has_ascenseur: buildingData.building.has_ascenseur ?? false,
            has_gardien: buildingData.building.has_gardien ?? false,
            has_interphone: buildingData.building.has_interphone ?? false,
            has_digicode: buildingData.building.has_digicode ?? false,
            has_local_velo: buildingData.building.has_local_velo ?? false,
            has_local_poubelles: buildingData.building.has_local_poubelles ?? false,
            has_parking_commun: (buildingData.building as any).has_parking_commun ?? false,
            has_jardin_commun: (buildingData.building as any).has_jardin_commun ?? false,
            building_units: (buildingData.units ?? []).map((u: any) => ({
              id: u.id,
              floor: u.floor,
              position: u.position,
              type: u.type,
              surface: u.surface,
              nb_pieces: u.nb_pieces,
              template: u.template,
              meuble: u.meuble ?? false,
              loyer_hc: u.loyer_hc,
              charges: u.charges,
              depot_garantie: u.depot_garantie,
              status: u.status,
            })),
          };
        }
      }

      set({
        propertyId: id,
        buildingId,
        formData: { ...(property as WizardFormData), ...buildingFormData },
        rooms,
        photos,
        syncStatus: 'saved'
      });
    } catch (error: unknown) {
      console.error('[WizardStore] Erreur chargement:', error);
      const errorMessage = "Impossible de charger le bien";
      set({ syncStatus: 'error', lastError: errorMessage });
      showSyncErrorToast(errorMessage);
    }
  },

  // SOTA 2026: updateFormData avec DEBOUNCE par propertyId pour optimiser les appels API
  // Avec support Undo/Redo
  updateFormData: (updates) => {
    const { propertyId, formData, history, historyIndex, maxHistoryLength } = get();

    // 1. Sauvegarder l'état actuel dans l'historique (pour undo)
    // On tronque l'historique après l'index courant (supprimer les états "redo")
    const newHistory = [...history.slice(0, historyIndex + 1), { ...formData }];
    // Limiter la taille de l'historique
    const trimmedHistory = newHistory.length > maxHistoryLength
      ? newHistory.slice(newHistory.length - maxHistoryLength)
      : newHistory;

    // 2. Optimistic Update immédiat avec mise à jour de l'historique
    set((state) => ({
      formData: { ...state.formData, ...updates },
      history: trimmedHistory,
      historyIndex: trimmedHistory.length - 1,
      syncStatus: propertyId ? 'saving' : 'idle'
    }));

    // 3. Si pas de propertyId, pas de sync serveur
    if (!propertyId) {
      return;
    }

    // 3. Récupérer le state de debounce pour CE propertyId
    const debounce = getDebounceState(propertyId);

    // 4. Accumuler les updates
    debounce.pendingUpdates = { ...debounce.pendingUpdates, ...updates };

    // 5. Clear timer précédent
    if (debounce.timer) {
      clearTimeout(debounce.timer);
    }

    // 6. Créer nouveau timer avec capture du propertyId
    const capturedPropertyId = propertyId;
    debounce.timer = setTimeout(async () => {
      const currentDebounce = debounceState.get(capturedPropertyId);
      if (!currentDebounce) return;

      const updatesToSend = { ...currentDebounce.pendingUpdates };
      currentDebounce.pendingUpdates = {};
      currentDebounce.timer = null;

      try {
        await propertiesService.updatePropertyGeneral(capturedPropertyId, updatesToSend as Partial<WizardFormData>);
        if (get().propertyId === capturedPropertyId) {
          set({ syncStatus: 'saved' });
        }
      } catch (err: unknown) {
        console.error('[WizardStore] Erreur sauvegarde:', err);
        if (get().propertyId === capturedPropertyId) {
          const errorMessage = "Erreur sauvegarde";
          set({ syncStatus: 'error', lastError: errorMessage });
          showSyncErrorToast(errorMessage);
        }
      }
    }, UPDATE_DEBOUNCE_MS);
  },

  addRoom: (roomData) => {
    const tempId = generateTempId();
    const newRoom = { ...roomData, id: tempId } as Room;
    const { propertyId } = get();
    
    // Optimistic UI + calcul automatique nb_pieces/nb_chambres
    // ✅ Fix: Ne passer à 'saving' que si propertyId existe
    set((state) => {
      const updatedRooms = [...state.rooms, newRoom];
      const counts = calculateRoomCounts(updatedRooms);
      return { 
        rooms: updatedRooms,
        formData: { ...state.formData, nb_pieces: counts.nb_pieces, nb_chambres: counts.nb_chambres },
        syncStatus: propertyId ? 'saving' : 'idle'
      };
    });

    const { formData } = get();
    if (propertyId && roomData.type_piece) {
      propertiesService.createRoom(propertyId, {
        type_piece: roomData.type_piece,
        label_affiche: roomData.label_affiche || "Nouvelle pièce",
        chauffage_present: roomData.chauffage_present ?? true,
        clim_presente: roomData.clim_presente ?? false,
        surface_m2: roomData.surface_m2
      }).then((serverRoom) => {
        // Remplacer l'ID temporaire par le vrai ID
        set((state) => ({
          rooms: state.rooms.map(r => r.id === tempId ? serverRoom : r),
          syncStatus: 'saved'
        }));
        // Sync nb_pieces/nb_chambres au serveur
        propertiesService.updatePropertyGeneral(propertyId, { 
          nb_pieces: formData.nb_pieces, 
          nb_chambres: formData.nb_chambres 
        }).catch(() => {});
      }).catch(() => {
        // Rollback en cas d'erreur
        const errorMessage = "Impossible de créer la pièce";
        set((state) => {
          const rolledBackRooms = state.rooms.filter(r => r.id !== tempId);
          const counts = calculateRoomCounts(rolledBackRooms);
          return {
            rooms: rolledBackRooms,
            formData: { ...state.formData, nb_pieces: counts.nb_pieces, nb_chambres: counts.nb_chambres },
            syncStatus: 'error',
            lastError: errorMessage
          };
        });
        showSyncErrorToast(errorMessage);
      });
    }
  },

  updateRoom: (id, updates) => {
    const { propertyId } = get();
    const isTemporary = id.startsWith('temp-');
    
    // Optimistic
    set((state) => ({
      rooms: state.rooms.map(r => r.id === id ? { ...r, ...updates } : r),
      // ✅ Fix: Si pièce temporaire ou pas de propertyId, rester 'idle'
      syncStatus: (isTemporary || !propertyId) ? 'idle' : 'saving'
    }));

    // Sync serveur seulement si pièce synchronisée
    if (propertyId && !isTemporary) {
      propertiesService.updateRoom(propertyId, id, updates as Partial<RoomPayload>)
        .then(() => set({ syncStatus: 'saved' }))
        .catch(() => {
          const errorMessage = "Erreur mise à jour pièce";
          set({ syncStatus: 'error', lastError: errorMessage });
          showSyncErrorToast(errorMessage);
        });
    }
  },

  removeRoom: (id) => {
    // Optimistic + calcul automatique nb_pieces/nb_chambres
    const oldRooms = get().rooms;
    const oldFormData = get().formData;
    const { propertyId } = get();
    
    // Vérifier si c'est une pièce temporaire (pas encore sync avec le serveur)
    const isTemporary = id.startsWith('temp-');
    
    set((state) => {
      const updatedRooms = state.rooms.filter(r => r.id !== id);
      const counts = calculateRoomCounts(updatedRooms);
      return {
        rooms: updatedRooms,
        formData: { ...state.formData, nb_pieces: counts.nb_pieces, nb_chambres: counts.nb_chambres },
        // ✅ Fix: Si pièce temporaire ou pas de propertyId, passer directement à 'idle'
        syncStatus: (isTemporary || !propertyId) ? 'idle' : 'saving'
      };
    });

    // Supprimer côté serveur seulement si pièce synchronisée
    if (propertyId && !isTemporary) {
      const { formData } = get();
      propertiesService.deleteRoom(propertyId, id)
        .then(() => {
          set({ syncStatus: 'saved' });
          // Sync nb_pieces/nb_chambres au serveur
          propertiesService.updatePropertyGeneral(propertyId, { 
            nb_pieces: formData.nb_pieces, 
            nb_chambres: formData.nb_chambres 
          }).catch(() => {});
        })
        .catch(() => {
          const errorMessage = "Erreur suppression pièce";
          set({ rooms: oldRooms, formData: oldFormData, syncStatus: 'error', lastError: errorMessage });
          showSyncErrorToast(errorMessage);
        });
    }
  },

  setPhotos: (photos) => set({ photos }),

  // 🆕 Actions import photos
  setPendingPhotoUrls: (urls) => set({ 
    pendingPhotoUrls: urls,
    photoImportStatus: urls.length > 0 ? 'idle' : 'done',
    photoImportProgress: { imported: 0, total: urls.length }
  }),
  
  importPendingPhotos: async () => {
    const { propertyId, pendingPhotoUrls, photos } = get();
    
    if (!propertyId || pendingPhotoUrls.length === 0) {
      console.info('[WizardStore] Pas de photos à importer');
      return;
    }
    
    console.info(`[WizardStore] Import de ${pendingPhotoUrls.length} photos...`);
    set({ photoImportStatus: 'importing' });
    
    try {
      const response = await fetch(`/api/properties/${propertyId}/photos/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: pendingPhotoUrls }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erreur import photos');
      }
      
      console.info(`[WizardStore] ✅ ${result.imported}/${result.total} photos importées`);
      
      // Recharger les photos depuis le serveur
      const photosResponse = await fetch(`/api/properties/${propertyId}/photos`);
      const { photos: newPhotos } = await photosResponse.json();
      
      set({
        photos: newPhotos || [],
        pendingPhotoUrls: [],
        photoImportStatus: 'done',
        photoImportProgress: { imported: result.imported, total: result.total }
      });
      
    } catch (error: unknown) {
      console.error('[WizardStore] Erreur import photos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur import photos';
      set({
        photoImportStatus: 'error',
        lastError: errorMessage,
        pendingPhotoUrls: [] // Éviter les tentatives en boucle
      });
      showSyncErrorToast(errorMessage);
    }
  },

  // Navigation
  setStep: (step) => set({ currentStep: step }),
  
  setMode: (mode) => set({ mode }),
  
  nextStep: () => {
    const { currentStep, formData, mode } = get();
    const propertyType = (formData.type as string) || "";

    if (currentStep === 'type_bien' && !propertyType) return;
    if (currentStep === 'address' && !formData.adresse_complete) return;

    const applicableSteps = getApplicableSteps(propertyType, mode);
    const currentIndex = applicableSteps.indexOf(currentStep);
    if (currentIndex < applicableSteps.length - 1) {
      set({ currentStep: applicableSteps[currentIndex + 1] });
    }
  },

  prevStep: () => {
    const { currentStep, formData, mode } = get();
    const propertyType = (formData.type as string) || "";
    const applicableSteps = getApplicableSteps(propertyType, mode);
    const currentIndex = applicableSteps.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: applicableSteps[currentIndex - 1] });
    }
  },

  // SOTA 2026: Undo/Redo Actions
  undo: () => {
    const { history, historyIndex, formData } = get();

    if (historyIndex < 0) {
      console.info('[WizardStore] Undo: rien à annuler');
      return;
    }

    // Sauvegarder l'état actuel avant d'annuler (pour redo)
    const newHistory = historyIndex === history.length - 1
      ? [...history, { ...formData }]
      : history;

    // Restaurer l'état précédent
    const previousState = history[historyIndex];
    console.info('[WizardStore] Undo: restauration de l\'état', historyIndex);

    set({
      formData: { ...previousState },
      history: newHistory,
      historyIndex: historyIndex - 1,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();

    if (historyIndex >= history.length - 1) {
      console.info('[WizardStore] Redo: rien à refaire');
      return;
    }

    // Restaurer l'état suivant
    const nextState = history[historyIndex + 1];
    console.info('[WizardStore] Redo: restauration de l\'état', historyIndex + 1);

    set({
      formData: { ...nextState },
      historyIndex: historyIndex + 1,
    });
  },

  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex >= 0;
  },

  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  clearHistory: () => {
    console.info('[WizardStore] Effacement de l\'historique');
    set({ history: [], historyIndex: -1 });
  }
    }),
    {
      name: 'property-wizard-storage',
      // SOTA 2026: Exclure les champs sensibles et transitoires de la persistance
      partialize: (state) => ({
        propertyId: state.propertyId,
        buildingId: state.buildingId,
        currentStep: state.currentStep,
        mode: state.mode,
        formData: state.formData,
        rooms: state.rooms,
        // Ne pas persister: photos (trop lourd), syncStatus, errors, isInitializing
      }),
      // Migrer les anciennes versions du store si nécessaire
      version: 1,
    }
  ),
  { name: "PropertyWizardStore", enabled: process.env.NODE_ENV === "development" }
  )
);


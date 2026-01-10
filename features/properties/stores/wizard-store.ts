import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { propertiesService } from '../services/properties.service';
import type { Property, Room, Photo } from '@/lib/types';
import type { PropertyTypeV3 } from '@/lib/types/property-v3';
import type { BuildingUnit } from '@/lib/types/building-v3';

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
export interface WizardFormData extends Partial<Property> {
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

  // SOTA 2026 - Champs spécifiques immeuble
  building_floors?: number;
  building_units?: BuildingUnit[];
  has_ascenseur?: boolean;
  has_gardien?: boolean;
  has_interphone?: boolean;
  has_digicode?: boolean;
  has_local_velo?: boolean;
  has_local_poubelles?: boolean;
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
const INITIAL_STATE: Omit<WizardState, 'reset' | 'initializeDraft' | 'loadProperty' | 'updateFormData' | 'addRoom' | 'updateRoom' | 'removeRoom' | 'setPhotos' | 'setPendingPhotoUrls' | 'importPendingPhotos' | 'setStep' | 'setMode' | 'nextStep' | 'prevStep'> = {
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
    has_ascenseur: false,
    has_gardien: false,
    has_interphone: false,
    has_digicode: false,
  },
  rooms: [],
  photos: [],
  pendingPhotoUrls: [],
  photoImportStatus: 'idle',
  photoImportProgress: { imported: 0, total: 0 },
};

// Compteur pour générer des IDs temporaires uniques (évite les doublons avec Date.now())
let tempIdCounter = 0;
function generateTempId(): string {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

// SOTA 2026: Debounce pour updateFormData - évite les appels API excessifs
let updateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const UPDATE_DEBOUNCE_MS = 500;

// SOTA 2026: Pending updates accumulator pour debounce
let pendingUpdates: Partial<WizardFormData> = {};

export const usePropertyWizardStore = create<WizardState>((set, get) => ({
  ...INITIAL_STATE,

  // --- ACTIONS ---

  // Réinitialise complètement le wizard pour une nouvelle création
  reset: () => {
    console.log('[WizardStore] Reset du wizard');
    // Clear debounce timer
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
      updateDebounceTimer = null;
    }
    pendingUpdates = {};
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
      console.log('[WizardStore] PropertyId existant, mise à jour du type uniquement');
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

      console.log(`[WizardStore] Draft créé avec succès: ${newPropertyId}`);
    } catch (error: any) {
      console.error('[WizardStore] Erreur création draft:', error);
      set({
        syncStatus: 'error',
        lastError: error.message || "Erreur lors de la création du brouillon",
        isInitializing: false
      });
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
      set({
        propertyId: id,
        formData: property as WizardFormData,
        rooms,
        photos,
        syncStatus: 'saved'
      });
    } catch (error: any) {
      console.error('[WizardStore] Erreur chargement:', error);
      set({ syncStatus: 'error', lastError: "Impossible de charger le bien" });
    }
  },

  // SOTA 2026: updateFormData avec DEBOUNCE pour optimiser les appels API
  updateFormData: (updates) => {
    const { propertyId } = get();

    // 1. Optimistic Update immédiat
    set((state) => ({
      formData: { ...state.formData, ...updates },
      syncStatus: propertyId ? 'saving' : 'idle'
    }));

    // 2. Accumuler les updates pour le debounce
    pendingUpdates = { ...pendingUpdates, ...updates };

    // 3. Si pas de propertyId, pas de sync serveur
    if (!propertyId) {
      return;
    }

    // 4. Clear timer précédent et créer nouveau
    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }

    updateDebounceTimer = setTimeout(async () => {
      const updatesToSend = { ...pendingUpdates };
      pendingUpdates = {};

      try {
        await propertiesService.updatePropertyGeneral(propertyId, updatesToSend as any);
        set({ syncStatus: 'saved' });
      } catch (err: any) {
        console.error('[WizardStore] Erreur sauvegarde:', err);
        set({ syncStatus: 'error', lastError: "Erreur sauvegarde" });
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
    if (propertyId) {
      propertiesService.createRoom(propertyId, {
        type_piece: roomData.type_piece as any,
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
        set((state) => {
          const rolledBackRooms = state.rooms.filter(r => r.id !== tempId);
          const counts = calculateRoomCounts(rolledBackRooms);
          return {
            rooms: rolledBackRooms,
            formData: { ...state.formData, nb_pieces: counts.nb_pieces, nb_chambres: counts.nb_chambres },
            syncStatus: 'error',
            lastError: "Impossible de créer la pièce"
          };
        });
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
      propertiesService.updateRoom(propertyId, id, updates as any)
        .then(() => set({ syncStatus: 'saved' }))
        .catch(() => set({ syncStatus: 'error' }));
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
          set({ rooms: oldRooms, formData: oldFormData, syncStatus: 'error', lastError: "Erreur suppression" });
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
      console.log('[WizardStore] Pas de photos à importer');
      return;
    }
    
    console.log(`[WizardStore] Import de ${pendingPhotoUrls.length} photos...`);
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
      
      console.log(`[WizardStore] ✅ ${result.imported}/${result.total} photos importées`);
      
      // Recharger les photos depuis le serveur
      const photosResponse = await fetch(`/api/properties/${propertyId}/photos`);
      const { photos: newPhotos } = await photosResponse.json();
      
      set({
        photos: newPhotos || [],
        pendingPhotoUrls: [],
        photoImportStatus: 'done',
        photoImportProgress: { imported: result.imported, total: result.total }
      });
      
    } catch (error: any) {
      console.error('[WizardStore] Erreur import photos:', error);
      set({ 
        photoImportStatus: 'error',
        lastError: error.message 
      });
    }
  },

  // Navigation
  setStep: (step) => set({ currentStep: step }),
  
  setMode: (mode) => set({ mode }),
  
  nextStep: () => {
    const { currentStep, formData, mode } = get();
    const propertyType = (formData.type as string) || "";
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
  }
}));


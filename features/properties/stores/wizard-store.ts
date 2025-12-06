import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { propertiesService } from '../services/properties.service';
import type { Property, Room, Photo } from '@/lib/types';
import type { PropertyTypeV3 } from '@/lib/types/property-v3';

// Types
export type WizardStep = 'type_bien' | 'address' | 'details' | 'rooms' | 'photos' | 'recap';
type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

interface WizardState {
  // État Global
  propertyId: string | null;
  currentStep: WizardStep;
  syncStatus: SyncStatus;
  lastError: string | null;

  // Données
  formData: Partial<Property>;
  rooms: Room[];
  photos: Photo[];
  
  // 🆕 Photos à importer depuis scraping
  pendingPhotoUrls: string[];
  photoImportStatus: 'idle' | 'importing' | 'done' | 'error';
  photoImportProgress: { imported: number; total: number };

  // Actions
  reset: () => void; // 🔧 Réinitialise le wizard pour une nouvelle création
  initializeDraft: (type: PropertyTypeV3) => Promise<void>;
  loadProperty: (id: string) => Promise<void>;
  updateFormData: (updates: Partial<Property>) => void; // Optimiste
  addRoom: (room: Partial<Room>) => void; // Optimiste
  updateRoom: (id: string, updates: Partial<Room>) => void; // Optimiste
  removeRoom: (id: string) => void; // Optimiste
  setPhotos: (photos: Photo[]) => void;
  
  // 🆕 Import photos
  setPendingPhotoUrls: (urls: string[]) => void;
  importPendingPhotos: () => Promise<void>;
  
  // Navigation
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
}

// Mapping des étapes (ordre logique)
const STEPS_ORDER: WizardStep[] = ['type_bien', 'address', 'details', 'rooms', 'photos', 'recap'];

// Types de biens qui n'ont PAS d'étape "rooms" (pas de pièces à configurer)
// ⚠️ Aligné avec TypeStep.tsx : utiliser les vrais IDs (local_commercial, bureaux, etc.)
const TYPES_WITHOUT_ROOMS_STEP = [
  "parking", 
  "box", 
  "local_commercial", 
  "bureaux", 
  "entrepot", 
  "fonds_de_commerce"
];

// Fonction pour obtenir les étapes applicables selon le type de bien
function getApplicableSteps(propertyType: string | undefined): WizardStep[] {
  if (propertyType && TYPES_WITHOUT_ROOMS_STEP.includes(propertyType)) {
    return STEPS_ORDER.filter(step => step !== 'rooms');
  }
  return STEPS_ORDER;
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

// État initial pour le reset
const INITIAL_STATE = {
  propertyId: null,
  currentStep: 'type_bien' as WizardStep,
  syncStatus: 'idle' as SyncStatus,
  lastError: null,
  formData: { etat: 'draft' } as Partial<Property>,
  rooms: [] as Room[],
  photos: [] as Photo[],
  // 🆕 Photos import
  pendingPhotoUrls: [] as string[],
  photoImportStatus: 'idle' as 'idle' | 'importing' | 'done' | 'error',
  photoImportProgress: { imported: 0, total: 0 },
};

// Compteur pour générer des IDs temporaires uniques (évite les doublons avec Date.now())
let tempIdCounter = 0;
function generateTempId(): string {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}-${Math.random().toString(36).substring(2, 7)}`;
}

export const usePropertyWizardStore = create<WizardState>((set, get) => ({
  ...INITIAL_STATE,

  // --- ACTIONS ---

  // 🔧 Réinitialise complètement le wizard pour une nouvelle création
  reset: () => {
    console.log('[WizardStore] Reset du wizard');
    set(INITIAL_STATE);
  },

  initializeDraft: async (type) => {
    set({ syncStatus: 'saving' });
    try {
      const { propertyId } = await propertiesService.createDraftPropertyInit(type);
      set({ 
        propertyId, 
        formData: { ...get().formData, type_bien: type, type }, // Sync local
        syncStatus: 'saved' 
      });
    } catch (error: any) {
      set({ syncStatus: 'error', lastError: error.message || "Erreur création" });
    }
  },

  loadProperty: async (id) => {
    set({ syncStatus: 'saving' }); // Indicateur de chargement
    try {
      const [property, rooms, photos] = await Promise.all([
        propertiesService.getPropertyById(id),
        propertiesService.listRooms(id),
        propertiesService.listPhotos(id)
      ]);
      set({ 
        propertyId: id, 
        formData: property, 
        rooms, 
        photos,
        syncStatus: 'saved'
      });
    } catch (error: any) {
      set({ syncStatus: 'error', lastError: "Impossible de charger le bien" });
    }
  },

  updateFormData: (updates) => {
    const { propertyId } = get();
    
    // 1. Optimistic Update - ne passer à 'saving' que si on va réellement sauvegarder
    set((state) => ({ 
      formData: { ...state.formData, ...updates },
      syncStatus: propertyId ? 'saving' : 'idle' // ✅ Fix: rester 'idle' si pas de propertyId
    }));

    // 2. Background Sync seulement si le bien existe déjà en base
    if (propertyId) {
      propertiesService.updatePropertyGeneral(propertyId, updates as any)
        .then(() => set({ syncStatus: 'saved' }))
        .catch((err) => {
          console.error('[WizardStore] Erreur sauvegarde:', err);
          set({ syncStatus: 'error', lastError: "Erreur sauvegarde" });
        });
    }
    // Si pas de propertyId, les données sont stockées localement en attendant l'initialisation
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
  
  nextStep: () => {
    const { currentStep, formData } = get();
    const propertyType = (formData.type as string) || "";
    const applicableSteps = getApplicableSteps(propertyType);
    const currentIndex = applicableSteps.indexOf(currentStep);
    if (currentIndex < applicableSteps.length - 1) {
      set({ currentStep: applicableSteps[currentIndex + 1] });
    }
  },

  prevStep: () => {
    const { currentStep, formData } = get();
    const propertyType = (formData.type as string) || "";
    const applicableSteps = getApplicableSteps(propertyType);
    const currentIndex = applicableSteps.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: applicableSteps[currentIndex - 1] });
    }
  }
}));


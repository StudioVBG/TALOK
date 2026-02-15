"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Home,
  Calendar,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  Camera,
  Save,
  Loader2,
  Trash2,
  Key,
  DoorOpen,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";

// Import extracted types and constants from ./config/
import type { Lease, RoomData, MeterReading, KeyItem } from "./config/types";
import { prepareImageForUpload } from "@/lib/helpers/image-compression";
import {
  ROOM_TEMPLATES,
  CONDITION_OPTIONS,
  STEPS,
  METER_TYPES,
  DEFAULT_KEY_TYPES,
  DEFAULT_METER_READINGS,
  DEFAULT_KEYS,
} from "./config/constants";
import { useAutoSave } from "@/hooks/useAutoSave";

interface Props {
  leases: Lease[];
  preselectedLeaseId?: string;
  preselectedType?: "entree" | "sortie";
}

export function CreateInspectionWizard({ leases, preselectedLeaseId, preselectedType }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État pour la barre de progression lors de la création
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadDetails, setUploadDetails] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Form state - Auto-select lease if preselectedLeaseId is provided
  const initialLease = preselectedLeaseId 
    ? leases.find(l => l.id === preselectedLeaseId) || null 
    : null;
  const [selectedLease, setSelectedLease] = useState<Lease | null>(initialLease);
  const [edlType, setEdlType] = useState<"entree" | "sortie">(preselectedType || "entree");
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [propertyRooms, setPropertyRooms] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  
  // État pour les compteurs (defaults imported from ./config/constants)
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>(DEFAULT_METER_READINGS);

  // État pour les clés (defaults imported from ./config/constants)
  const [keys, setKeys] = useState<KeyItem[]>(DEFAULT_KEYS);

  // Auto-save: persiste l'état du wizard dans localStorage
  const autoSaveData = useMemo(() => ({
    step,
    selectedLeaseId: selectedLease?.id || null,
    edlType,
    scheduledDate,
    selectedRooms,
    roomsData,
    currentRoomIndex,
    generalNotes,
    meterReadings,
    keys,
  }), [step, selectedLease, edlType, scheduledDate, selectedRooms, roomsData, currentRoomIndex, generalNotes, meterReadings, keys]);

  // Désactiver la restauration auto-save quand on arrive depuis un bail avec des paramètres URL
  // (l'utilisateur veut un EDL pour CE bail, pas reprendre un ancien brouillon)
  const hasUrlPreselection = !!preselectedLeaseId;

  const { clearSaved: clearAutoSave } = useAutoSave({
    key: "edl-wizard",
    data: autoSaveData,
    enabled: true,
    onRestore: useCallback((saved: typeof autoSaveData) => {
      // Si on arrive depuis un lien bail (URL avec lease_id), ignorer le brouillon
      if (hasUrlPreselection) return;

      if (saved.step) setStep(saved.step);
      if (saved.selectedLeaseId) {
        const lease = leases.find(l => l.id === saved.selectedLeaseId);
        if (lease) setSelectedLease(lease);
      }
      if (saved.edlType) setEdlType(saved.edlType);
      if (saved.scheduledDate) setScheduledDate(saved.scheduledDate);
      if (saved.selectedRooms?.length) setSelectedRooms(saved.selectedRooms);
      if (saved.roomsData?.length) setRoomsData(saved.roomsData);
      if (saved.currentRoomIndex != null) setCurrentRoomIndex(saved.currentRoomIndex);
      if (saved.generalNotes) setGeneralNotes(saved.generalNotes);
      if (saved.meterReadings?.length) setMeterReadings(saved.meterReadings);
      if (saved.keys?.length) setKeys(saved.keys);
      toast({ title: "Brouillon restauré", description: "Votre saisie précédente a été récupérée.", duration: 3000 });
    }, [leases, toast, hasUrlPreselection]),
  });

  // Auto-avancer si bail présélectionné (depuis lien direct)
  // IMPORTANT: ne jamais sauter l'étape 1 (type + date) car scheduledDate est obligatoire
  useEffect(() => {
    if (preselectedLeaseId && initialLease && step === 0) {
      // Bail + type fournis → avancer vers étape Type/Date (step 1)
      // On NE saute PAS l'étape date sinon l'API renvoie 400 "Date de planification requise"
      setStep(1);
      if (preselectedType) {
        toast({
          title: "EDL pré-configuré",
          description: `${initialLease.property.adresse_complete} — ${preselectedType === "entree" ? "Entrée" : "Sortie"}. Choisissez la date.`,
        });
      } else {
        toast({
          title: "Bail sélectionné",
          description: `${initialLease.property.adresse_complete} - ${initialLease.tenant_name}`,
        });
      }
    }
  }, [preselectedLeaseId, initialLease]);

  // Charger les compteurs existants quand un bail est sélectionné
  useEffect(() => {
    async function loadPropertyMeters() {
      if (!selectedLease) return;
      
      try {
        const response = await fetch(`/api/properties/${selectedLease.property.id}/meters`);
        if (response.ok) {
          const { meters } = await response.json();
          
          if (meters && meters.length > 0) {
            // Mapper les compteurs existants vers le format du wizard
            const existingMeters: MeterReading[] = meters.map((m: any) => {
              // Déterminer le type correct
              let meterType: MeterReading["type"] = m.type;
              if (m.provider === "Eau chaude") meterType = "water_hot";
              
              return {
                type: meterType,
                meterNumber: m.meter_number || "",
                reading: "", // Laisser vide pour que l'utilisateur saisisse le nouveau relevé
                unit: m.unit === "kwh" ? "kWh" : m.unit === "m3" ? "m³" : m.unit,
                photo: undefined,
              };
            });
            
            setMeterReadings(existingMeters);
            toast({
              title: "Compteurs chargés",
              description: `${meters.length} compteur(s) trouvé(s) pour ce logement.`,
            });
          } else {
            // Pas de compteurs, remettre les valeurs par défaut
            setMeterReadings([
              { type: "electricity", meterNumber: "", reading: "", unit: "kWh" },
              { type: "water", meterNumber: "", reading: "", unit: "m³" },
            ]);
          }
        }
      } catch (error) {
        console.error("Erreur chargement compteurs:", error);
      }
    }
    
    loadPropertyMeters();
  }, [selectedLease, toast]);

  // Charger les pièces du logement quand un bail est sélectionné
  useEffect(() => {
    async function loadPropertyRooms() {
      if (!selectedLease) {
        setPropertyRooms([]);
        return;
      }
      
      try {
        setIsLoadingRooms(true);
        const response = await fetch(`/api/properties/${selectedLease.property.id}/rooms`);
        if (response.ok) {
          const { rooms } = await response.json();
          
          if (rooms && rooms.length > 0) {
            setPropertyRooms(rooms);
            // Pré-sélectionner toutes les pièces par défaut
            setSelectedRooms(rooms.map((r: any) => r.id));
            toast({
              title: "Pièces chargées",
              description: `${rooms.length} pièce(s) trouvée(s) pour ce logement.`,
            });
          } else {
            // Pas de pièces enregistrées, utiliser les templates par défaut
            setPropertyRooms([]);
            toast({
              title: "Aucune pièce configurée",
              description: "Utilisez les pièces standard par défaut.",
            });
          }
        }
      } catch (error) {
        console.error("Erreur chargement pièces:", error);
        setPropertyRooms([]);
      } finally {
        setIsLoadingRooms(false);
      }
    }
    
    loadPropertyRooms();
  }, [selectedLease, toast]);

  const canProceed = useCallback(() => {
    switch (step) {
      case 0:
        return selectedLease !== null;
      case 1:
        return edlType && scheduledDate;
      case 2:
        // Au moins un compteur avec un relevé
        return meterReadings.some(m => m.reading.trim() !== "");
      case 3:
        return selectedRooms.length > 0;
      case 4:
        return roomsData.length > 0;
      case 5:
        // Au moins une clé
        return keys.length > 0 && keys.some(k => k.type.trim() !== "");
      case 6:
        return true;
      default:
        return false;
    }
  }, [step, selectedLease, edlType, scheduledDate, meterReadings, selectedRooms.length, roomsData.length, keys]);
  
  // Fonctions pour gérer les compteurs
  const updateMeterReading = (index: number, field: keyof MeterReading, value: string) => {
    setMeterReadings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  
  const addMeter = (type: MeterReading["type"]) => {
    const meterType = METER_TYPES.find(m => m.type === type);
    if (meterType) {
      setMeterReadings(prev => [...prev, {
        type,
        meterNumber: "",
        reading: "",
        unit: meterType.unit,
      }]);
    }
  };
  
  const removeMeter = (index: number) => {
    setMeterReadings(prev => prev.filter((_, i) => i !== index));
  };

  const handleRoomToggle = (roomId: string) => {
    setSelectedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
  };

  // Constante pour la limite de taille des photos (4 Mo)
  const MAX_PHOTO_SIZE_MB = 4;
  const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

  // Validation et avertissement pour les photos volumineuses
  const validateAndWarnPhotoSize = (files: File[]): File[] => {
    const largePhotos = files.filter(f => f.size > MAX_PHOTO_SIZE_BYTES);
    if (largePhotos.length > 0) {
      toast({
        title: "Photos volumineuses détectées",
        description: `${largePhotos.length} photo(s) dépassent ${MAX_PHOTO_SIZE_MB} Mo et seront compressées automatiquement lors de l'envoi.`,
        variant: "default",
      });
    }
    return files;
  };

  const handlePhotoUpload = (roomIndex: number, itemIndex: number, files: FileList | null) => {
    if (!files) return;
    const newPhotos = validateAndWarnPhotoSize(Array.from(files));
    setRoomsData((prev) => {
      const updated = [...prev];
      const items = [...updated[roomIndex].items];
      items[itemIndex] = {
        ...items[itemIndex],
        photos: [...items[itemIndex].photos, ...newPhotos]
      };
      updated[roomIndex] = { ...updated[roomIndex], items };
      return updated;
    });
  };

  const removePhoto = (roomIndex: number, itemIndex: number, photoIndex: number) => {
    setRoomsData((prev) => {
      const updated = [...prev];
      const items = [...updated[roomIndex].items];
      items[itemIndex] = {
        ...items[itemIndex],
        photos: items[itemIndex].photos.filter((_, i) => i !== photoIndex)
      };
      updated[roomIndex] = { ...updated[roomIndex], items };
      return updated;
    });
  };

  const handleGlobalPhotoUpload = (roomIndex: number, files: FileList | null) => {
    if (!files) return;
    const newPhotos = validateAndWarnPhotoSize(Array.from(files));
    setRoomsData((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        globalPhotos: [...(updated[roomIndex].globalPhotos || []), ...newPhotos]
      };
      return updated;
    });
  };

  const removeGlobalPhoto = (roomIndex: number, photoIndex: number) => {
    setRoomsData((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        globalPhotos: updated[roomIndex].globalPhotos?.filter((_, i) => i !== photoIndex) || []
      };
      return updated;
    });
  };

  const getTotalRoomPhotos = (room: RoomData) => {
    const itemPhotosCount = room.items.reduce((acc, item) => acc + (item.photos?.length || 0), 0);
    const globalPhotosCount = room.globalPhotos?.length || 0;
    return itemPhotosCount + globalPhotosCount;
  };

  const handleMeterPhotoUpload = async (index: number, file: File) => {
    updateMeterReading(index, "photo", file as any);
    
    // Tentative d'OCR si c'est une image
    if (file.type.startsWith("image/") && selectedLease) {
      toast({
        title: "Analyse en cours...",
        description: "Nous extrayons l'index de la photo.",
      });
      
      try {
        const formData = new FormData();
        formData.append("photo", file);
        
        // On utilise un ID temporaire ou "new" pour l'OCR si le compteur n'existe pas encore
        const response = await fetch(`/api/meters/new/photo-ocr?property_id=${selectedLease.property.id}`, {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const { reading } = await response.json();
          if (reading?.reading_value) {
            updateMeterReading(index, "reading", reading.reading_value.toString());
            toast({
              title: "Index extrait !",
              description: `Valeur détectée : ${reading.reading_value} ${reading.unit || ""}`,
            });
          }
        }
      } catch (error) {
        console.error("OCR Error:", error);
      }
    }
  };

  const initializeRoomsData = () => {
    const rooms: RoomData[] = selectedRooms.map((roomId) => {
      // Chercher d'abord dans les pièces du logement
      const propertyRoom = propertyRooms.find((r) => r.id === roomId);
      
      if (propertyRoom) {
        // MAPPING: label_affiche -> name, type_piece -> type
        const roomName = propertyRoom.label_affiche || propertyRoom.name;
        const roomType = propertyRoom.type_piece || propertyRoom.type;

        // Utiliser les éléments standard pour cette pièce
        const template = ROOM_TEMPLATES.find(
          (t) => (t.name && roomName && t.name.toLowerCase() === roomName.toLowerCase()) ||
                 (t.id && roomType && t.id === roomType)
        );
        const items = template?.items || [
          "Sol", "Murs", "Plafond", "Fenêtres", "Portes", "Prises électriques", "Éclairage"
        ];
        
        return {
          name: roomName || "Pièce sans nom",
          items: items.map((item) => ({
            name: item,
            condition: null,
            notes: "",
            photos: [],
          })),
          globalPhotos: [],
        };
      }
      
      // Sinon utiliser le template par défaut
      const template = ROOM_TEMPLATES.find((t) => t.id === roomId);
      return {
        name: template?.name || roomId,
        items: (template?.items || []).map((item) => ({
          name: item,
          condition: null,
          notes: "",
          photos: [],
        })),
        globalPhotos: [],
      };
    });
    setRoomsData(rooms);
    setCurrentRoomIndex(0);
  };

  const handleNext = () => {
    if (step === 4 && currentRoomIndex < roomsData.length - 1) {
      setCurrentRoomIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      if (step === 3) {
        initializeRoomsData();
      }
      setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handlePrev = () => {
    if (step === 4 && currentRoomIndex > 0) {
      setCurrentRoomIndex(prev => prev - 1);
    } else {
      setStep((prev) => Math.max(prev - 1, 0));
    }
  };

  const updateItemCondition = (
    roomIndex: number,
    itemIndex: number,
    condition: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais"
  ) => {
    setRoomsData((prev) => {
      const updated = [...prev];
      updated[roomIndex].items[itemIndex].condition = condition;
      return updated;
    });
  };

  const updateItemNotes = (roomIndex: number, itemIndex: number, notes: string) => {
    setRoomsData((prev) => {
      const updated = [...prev];
      updated[roomIndex].items[itemIndex].notes = notes;
      return updated;
    });
  };

  const addItemToRoom = (roomIndex: number) => {
    const itemName = window.prompt("Nom de l'élément à ajouter (ex: Canapé, Miroir...)");
    if (!itemName) return;

    setRoomsData((prev) => {
      const updated = [...prev];
      updated[roomIndex].items.push({
        name: itemName,
        condition: null,
        notes: "",
        photos: []
      });
      return updated;
    });
  };

  const removeItemFromRoom = async (roomIndex: number, itemIndex: number) => {
    const confirmed = await confirm({
      title: "Supprimer cet élément ?",
      description: "L'élément sera retiré de l'inspection. Cette action peut être annulée en ajoutant à nouveau l'élément.",
      variant: "danger",
    });

    if (!confirmed) return;

    setRoomsData((prev) => {
      const updated = [...prev];
      updated[roomIndex].items.splice(itemIndex, 1);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedLease) return;

    // Validation côté client — filet de sécurité avant envoi API
    if (!scheduledDate) {
      toast({
        title: "Date manquante",
        description: "Veuillez indiquer la date prévue de l'état des lieux.",
        variant: "destructive",
      });
      setStep(1); // Renvoyer vers l'étape date
      return;
    }

    // Calculer le nombre total d'opérations pour la progression
    const validMeterReadings = meterReadings.filter(m => m.reading.trim() !== "");
    const totalPhotos = roomsData.reduce((acc, room) => {
      const roomPhotos = room.globalPhotos?.length || 0;
      const itemPhotos = room.items.reduce((sum, item) => sum + item.photos.length, 0);
      return acc + roomPhotos + itemPhotos;
    }, 0);

    // Étapes: création EDL (10%) + compteurs (20%) + sections (10%) + photos (60%)
    const hasMeters = validMeterReadings.length > 0;
    const hasPhotos = totalPhotos > 0;

    try {
      setIsSubmitting(true);
      setUploadProgress(0);
      setUploadStep("Création de l'état des lieux...");
      setUploadDetails("");

      // Helper pour les requêtes avec retry automatique, indicateur visuel et logs structurés
      const safeFetch = async (url: string, options?: RequestInit, maxRetries = 2) => {
        let lastError: Error | null = null;
        const startTime = Date.now();

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Indicateur de retry visible
            if (attempt > 0) {
              setIsRetrying(true);
              setRetryCount(attempt);
              setUploadDetails(prev => `${prev} (tentative ${attempt + 1}/${maxRetries + 1})`);

              // Log structuré pour monitoring
              console.info(JSON.stringify({
                event: "edl_wizard_retry",
                url: url.replace(/\/api\//, ""),
                attempt: attempt + 1,
                maxRetries: maxRetries + 1,
                timestamp: new Date().toISOString(),
              }));
            }

            const res = await fetch(url, options);

            // Réinitialiser l'indicateur de retry après succès
            if (attempt > 0) {
              setIsRetrying(false);
              setRetryCount(0);
            }

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              const err = new Error(errorData.error || `Erreur ${res.status}`);

              // Log structuré pour les erreurs HTTP
              console.error(JSON.stringify({
                event: "edl_wizard_http_error",
                url: url.replace(/\/api\//, ""),
                status: res.status,
                error: errorData.error || `HTTP ${res.status}`,
                attempt: attempt + 1,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
              }));

              // Ne pas retry les erreurs 4xx (client) sauf 408/429
              if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
                setIsRetrying(false);
                throw err;
              }
              lastError = err;
              if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                continue;
              }
              throw err;
            }

            // Log succès après retry
            if (attempt > 0) {
              console.info(JSON.stringify({
                event: "edl_wizard_retry_success",
                url: url.replace(/\/api\//, ""),
                attempts: attempt + 1,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString(),
              }));
            }

            return res;
          } catch (err: any) {
            lastError = err;

            // Log structuré pour les erreurs réseau
            console.error(JSON.stringify({
              event: "edl_wizard_network_error",
              url: url.replace(/\/api\//, ""),
              error: err.message,
              attempt: attempt + 1,
              duration: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }));

            // Retry sur erreurs réseau
            if ((err.message === "Load failed" || err.message === "Failed to fetch") && attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
              continue;
            }
            if (err.message === "Load failed" || err.message === "Failed to fetch") {
              setIsRetrying(false);
              throw new Error("Erreur réseau - vérifiez votre connexion internet");
            }
            setIsRetrying(false);
            throw err;
          }
        }
        setIsRetrying(false);
        throw lastError || new Error("Erreur inattendue");
      };

      // 1. Créer l'EDL
      const response = await safeFetch(`/api/properties/${selectedLease.property.id}/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: edlType,
          scheduled_at: scheduledDate,
          lease_id: selectedLease.id,
          general_notes: generalNotes,
          keys: keys.filter(k => k.type.trim() !== "").map(k => ({
            type: k.type,
            quantite: k.count,
            notes: k.notes
          })),
        }),
      });

      const { edl } = await response.json();
      setUploadProgress(10);

      // 2. Gérer les relevés des compteurs
      setUploadStep("Enregistrement des compteurs...");
      // On récupère d'abord les compteurs existants pour ne pas recréer
      const metersRes = await safeFetch(`/api/properties/${selectedLease.property.id}/meters`);
      const { meters: existingMeters } = await metersRes.json();

      let meterIndex = 0;
      for (const mr of validMeterReadings) {
        meterIndex++;
        setUploadDetails(`Compteur ${meterIndex}/${validMeterReadings.length}`);
        // Distinguer eau chaude et froide dans le type ou provider si besoin
        const meterType = mr.type === "water_hot" ? "water" : mr.type;
        const meterLabel = mr.type === "water_hot" ? "Eau chaude" : mr.type === "water" ? "Eau froide" : mr.type;

        // Chercher par numéro ou par type si pas de numéro
        let meter = existingMeters.find((em: any) =>
          (mr.meterNumber && em.meter_number === mr.meterNumber) ||
          (!mr.meterNumber && em.type === meterType)
        );

        let meterId = meter?.id;

        if (!meterId) {
          // Créer le compteur
          const newMeterRes = await safeFetch(`/api/properties/${selectedLease.property.id}/meters`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: meterType,
              meter_number: mr.meterNumber || `SN-${mr.type}-${Date.now()}`,
              unit: mr.unit,
              provider: meterLabel,
              lease_id: selectedLease.id
            }),
          });
          const { meter: newMeter } = await newMeterRes.json();
          meterId = newMeter.id;
        }

        if (meterId) {
          const formData = new FormData();
          formData.append("reading_value", mr.reading);
          formData.append("reading_date", new Date().toISOString().split("T")[0]);
          if (mr.photo) {
            formData.append("photo", mr.photo);
          }

          // 2a. Sauvegarder dans l'historique général
          const readingRes = await safeFetch(`/api/meters/${meterId}/readings`, {
            method: "POST",
            body: formData,
          });
          const readingData = await readingRes.json();
          const photoPath = readingData.reading?.photo_url || null;

          // 2b. Sauvegarder spécifiquement pour cet EDL (snapshot)
          // On utilise FormData si on a une photo, sinon JSON avec la valeur obligatoire
          if (mr.photo) {
            // Avec photo: utiliser FormData pour upload direct vers edl_meter_readings
            const edlMeterFormData = new FormData();
            edlMeterFormData.append("meter_id", meterId);
            edlMeterFormData.append("meter_type", mr.type);
            edlMeterFormData.append("meter_number", mr.meterNumber || "");
            edlMeterFormData.append("manual_value", mr.reading);
            edlMeterFormData.append("reading_unit", mr.unit);
            edlMeterFormData.append("photo", mr.photo);

            await safeFetch(`/api/edl/${edl.id}/meter-readings`, {
              method: "POST",
              body: edlMeterFormData,
            });
          } else {
            // Sans photo: envoyer JSON avec la valeur manuelle (sera validée automatiquement)
            await safeFetch(`/api/edl/${edl.id}/meter-readings`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meter_id: meterId,
                meter_type: mr.type,
                meter_number: mr.meterNumber,
                reading_value: parseFloat(mr.reading),
                reading_unit: mr.unit,
                photo_path: photoPath, // Utilise le chemin de la photo déjà uploadée si disponible
              }),
            });
          }
        }
      }
      setUploadProgress(30);

      // 3. Créer les sections et items
      setUploadStep("Enregistrement des pièces...");
      setUploadDetails(`${roomsData.length} pièce(s)`);
      const sections = roomsData.map((room) => ({
        room_name: room.name,
        items: room.items.map((item) => ({
          room_name: room.name,
          item_name: item.name,
          condition: item.condition,
          notes: item.notes,
        })),
      }));

      const sectionsResponse = await safeFetch(`/api/edl/${edl.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });

      const { items: insertedItems } = await sectionsResponse.json();
      
      // 4. Sauvegarder les nouvelles pièces ou personnalisations dans le logement (optionnel)
      try {
        const existingRoomNames = propertyRooms.map(r => (r.label_affiche || r.name || "").toLowerCase());
        for (const room of roomsData) {
          if (!existingRoomNames.includes(room.name.toLowerCase())) {
            // Créer la pièce dans le logement pour les prochaines fois
            await fetch(`/api/properties/${selectedLease.property.id}/rooms`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type_piece: "autre",
                label_affiche: room.name,
                surface_m2: null,
                chauffage_present: false,
                clim_presente: false
              }),
            });
          }
        }
      } catch (e) {
        console.error("Erreur sauvegarde structure pièces:", e);
      }
      setUploadProgress(40);

      // 5. Uploader les photos des items et photos globales
      // FIX: Compresser les images côté client avant upload pour éviter les erreurs de taille
      if (totalPhotos > 0) {
        setUploadStep("Upload des photos...");
        let uploadedPhotos = 0;
        let itemOffset = 0;

        // Helper pour compresser une photo si nécessaire
        const compressPhotoIfNeeded = async (photo: File): Promise<File> => {
          try {
            const { file, wasCompressed } = await prepareImageForUpload(photo, {
              maxWidth: 1920,
              maxHeight: 1080,
              quality: 0.8,
              maxSizeBytes: 4 * 1024 * 1024, // 4 Mo max pour laisser une marge sous la limite de 5 Mo
            });
            if (wasCompressed) {
              console.info(`Photo compressée: ${photo.name} (${(photo.size / 1024 / 1024).toFixed(2)} Mo → ${(file.size / 1024 / 1024).toFixed(2)} Mo)`);
            }
            return file;
          } catch (e) {
            console.warn(`Compression échouée pour ${photo.name}, utilisation de l'original`, e);
            return photo;
          }
        };

        for (const room of roomsData) {
          // Photos globales de la pièce
          if (room.globalPhotos && room.globalPhotos.length > 0) {
            setUploadDetails(`Photo ${uploadedPhotos + 1}/${totalPhotos} (${room.name})`);
            const formData = new FormData();

            // Compresser les photos avant ajout au FormData
            for (const photo of room.globalPhotos) {
              const compressedPhoto = await compressPhotoIfNeeded(photo);
              formData.append("files", compressedPhoto);
            }
            formData.append("section", room.name);

            await safeFetch(`/api/inspections/${edl.id}/photos`, {
              method: "POST",
              body: formData,
            });
            uploadedPhotos += room.globalPhotos.length;
            setUploadProgress(40 + Math.round((uploadedPhotos / totalPhotos) * 55));
          }

          // Photos des items
          for (const item of room.items) {
            const insertedItem = insertedItems[itemOffset];
            if (item.photos.length > 0 && insertedItem) {
              setUploadDetails(`Photo ${uploadedPhotos + 1}/${totalPhotos} (${item.name})`);
              const formData = new FormData();

              // Compresser les photos avant ajout au FormData
              for (const photo of item.photos) {
                const compressedPhoto = await compressPhotoIfNeeded(photo);
                formData.append("files", compressedPhoto);
              }
              formData.append("section", room.name);

              await safeFetch(`/api/inspections/${edl.id}/photos?item_id=${insertedItem.id}`, {
                method: "POST",
                body: formData,
              });
              uploadedPhotos += item.photos.length;
              setUploadProgress(40 + Math.round((uploadedPhotos / totalPhotos) * 55));
            }
            itemOffset++;
          }
        }
      }

      setUploadProgress(100);
      setUploadStep("Finalisation...");
      setUploadDetails("");

      // Effacer le brouillon auto-save après succès
      clearAutoSave();

      toast({
        title: "État des lieux créé",
        description: "L'EDL a été créé avec succès avec tous les relevés et photos.",
      });

      router.push(`/owner/inspections/${edl.id}`);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer l'EDL",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
      setUploadStep("");
      setUploadDetails("");
    }
  };

  const currentRoom = roomsData[currentRoomIndex];

  return (
    <div className="p-4 md:p-6 w-full max-w-4xl mx-auto space-y-4 md:space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "États des lieux", href: "/owner/inspections" },
          { label: "Nouveau" }
        ]}
        homeHref="/owner/dashboard"
      />

      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Nouvel état des lieux</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Créez un EDL d&apos;entrée ou de sortie en quelques étapes
        </p>
      </div>

      {/* Progress Steps - Responsive */}
      <div className="flex items-center justify-between mb-4 md:mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-shrink-0">
            <div
              className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-colors text-sm md:text-base ${
                i < step
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === step
                  ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-8 md:w-16 lg:w-24 h-0.5 md:h-1 mx-1 md:mx-2 rounded ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 1: Select Lease */}
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Sélectionnez le bail
                </CardTitle>
                <CardDescription>
                  Choisissez le bail pour lequel vous souhaitez créer un état des lieux
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leases.length > 0 ? (
                  <div className="grid gap-3 sm:gap-4">
                    {leases.map((lease) => {
                      const existingEntree = lease.existing_edl_entree;
                      const existingSortie = lease.existing_edl_sortie;
                      const hasExistingEdl = !!existingEntree || !!existingSortie;

                      const EDL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
                        draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700" },
                        scheduled: { label: "Planifié", color: "bg-blue-100 text-blue-700" },
                        in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700" },
                        completed: { label: "Complété", color: "bg-indigo-100 text-indigo-700" },
                        signed: { label: "Signé", color: "bg-emerald-100 text-emerald-700" },
                      };

                      return (
                        <motion.div
                          key={lease.id}
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          onClick={() => setSelectedLease(lease)}
                          className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedLease?.id === lease.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="p-2.5 sm:p-3 rounded-lg bg-muted flex-shrink-0">
                              <Home className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm sm:text-base truncate">{lease.property.adresse_complete}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                {lease.property.code_postal} {lease.property.ville}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {lease.tenant_name}
                                </span>
                              </div>

                              {/* Indicateur EDL existant */}
                              {hasExistingEdl && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {existingEntree && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] sm:text-xs ${EDL_STATUS_LABELS[existingEntree.status]?.color || "bg-slate-100 text-slate-700"}`}
                                    >
                                      <ClipboardList className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                      EDL Entrée : {EDL_STATUS_LABELS[existingEntree.status]?.label || existingEntree.status}
                                    </Badge>
                                  )}
                                  {existingSortie && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] sm:text-xs ${EDL_STATUS_LABELS[existingSortie.status]?.color || "bg-slate-100 text-slate-700"}`}
                                    >
                                      <ClipboardList className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                      EDL Sortie : {EDL_STATUS_LABELS[existingSortie.status]?.label || existingSortie.status}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            {selectedLease?.id === lease.id && (
                              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                            )}
                          </div>

                          {/* Actions rapides pour EDL existant — visible quand le bail est sélectionné */}
                          {selectedLease?.id === lease.id && hasExistingEdl && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-3 pt-3 border-t border-dashed border-primary/20"
                            >
                              <p className="text-xs text-muted-foreground mb-2">
                                Un EDL existe déjà pour ce bail. Vous pouvez le continuer ou en créer un nouveau.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {existingEntree && existingEntree.status !== "signed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/owner/inspections/${existingEntree.id}`);
                                    }}
                                    aria-label="Continuer l'EDL d'entrée existant"
                                  >
                                    <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                                    Continuer l&apos;EDL d&apos;entrée
                                  </Button>
                                )}
                                {existingEntree && existingEntree.status === "signed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/owner/inspections/${existingEntree.id}`);
                                    }}
                                    aria-label="Voir l'EDL d'entrée signé"
                                  >
                                    <Check className="h-3.5 w-3.5 mr-1.5" />
                                    Voir l&apos;EDL signé
                                  </Button>
                                )}
                                {existingSortie && existingSortie.status !== "signed" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/owner/inspections/${existingSortie.id}`);
                                    }}
                                    aria-label="Continuer l'EDL de sortie existant"
                                  >
                                    <DoorOpen className="h-3.5 w-3.5 mr-1.5" />
                                    Continuer l&apos;EDL de sortie
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <Home className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold text-sm sm:text-base">Aucun bail éligible</h3>
                    <p className="text-sm text-muted-foreground">
                      Pour créer un EDL, vous devez avoir un bail :
                    </p>
                    <ul className="text-xs sm:text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• <strong>Signé par toutes les parties</strong> (EDL d&apos;entrée)</li>
                      <li>• <strong>Actif</strong> (EDL de sortie)</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Type & Date */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Type d&apos;état des lieux
                </CardTitle>
                <CardDescription>
                  Indiquez s&apos;il s&apos;agit d&apos;un EDL d&apos;entrée ou de sortie
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup
                  value={edlType}
                  onValueChange={(v) => setEdlType(v as "entree" | "sortie")}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <Label
                    htmlFor="entree"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      edlType === "entree"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="entree" id="entree" />
                    <div>
                      <p className="font-semibold">Entrée</p>
                      <p className="text-sm text-muted-foreground">
                        Début de location
                      </p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="sortie"
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      edlType === "sortie"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="sortie" id="sortie" />
                    <div>
                      <p className="font-semibold">Sortie</p>
                      <p className="text-sm text-muted-foreground">
                        Fin de location
                      </p>
                    </div>
                  </Label>
                </RadioGroup>

                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date prévue
                  </Label>
                  <Input
                    id="date"
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Relevés des compteurs */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  Relevés des compteurs
                </CardTitle>
                <CardDescription>
                  Notez les relevés de compteurs au moment de l&apos;état des lieux
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {meterReadings.map((meter, index) => {
                  const meterType = METER_TYPES.find(m => m.type === meter.type);
                  return (
                    <div key={index} className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{meterType?.icon}</span>
                          <span className="font-medium">{meterType?.label}</span>
                        </div>
                        {meterReadings.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMeter(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`meter-number-${index}`}>N° Compteur</Label>
                          <Input
                            id={`meter-number-${index}`}
                            placeholder="Ex: 12345678"
                            value={meter.meterNumber}
                            onChange={(e) => updateMeterReading(index, "meterNumber", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`meter-reading-${index}`}>Index ({meter.unit})</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`meter-reading-${index}`}
                              type="number"
                              placeholder="Ex: 15234"
                              value={meter.reading}
                              onChange={(e) => updateMeterReading(index, "reading", e.target.value)}
                            />
                            <div className="relative">
                              <Input
                                type="file"
                                id={`meter-photo-${index}`}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleMeterPhotoUpload(index, e.target.files[0]);
                                  }
                                }}
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className={meter.photo ? "text-green-600 border-green-200 bg-green-50" : ""}
                                onClick={() => document.getElementById(`meter-photo-${index}`)?.click()}
                                title="Prendre une photo / Scanner"
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {meter.photo && (
                            <p className="text-[10px] text-green-600 font-medium">Photo jointe ✓</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Boutons pour ajouter des compteurs */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <span className="text-sm text-muted-foreground mr-2 self-center">Ajouter :</span>
                  {METER_TYPES.filter(m => !meterReadings.some(r => r.type === m.type) || m.type === "electricity" || m.type === "water").map((type) => (
                    <Button
                      key={type.type}
                      variant="outline"
                      size="sm"
                      onClick={() => addMeter(type.type)}
                      className="gap-2"
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </Button>
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                  💡 <strong>Conseil :</strong> Prenez une photo de chaque compteur pour conserver une preuve du relevé.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Select Rooms */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5" />
                  Pièces à inspecter
                </CardTitle>
                <CardDescription>
                  {propertyRooms.length > 0 
                    ? `Pièces du logement "${selectedLease?.property.adresse_complete}"` 
                    : "Sélectionnez les pièces qui composent le logement"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRooms ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2">Chargement des pièces...</span>
                  </div>
                ) : propertyRooms.length > 0 ? (
                  /* Afficher les pièces réelles du logement */
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {propertyRooms.map((room) => {
                      const isSelected = selectedRooms.includes(room.id);
                      // MAPPING: label_affiche -> name, type_piece -> type
                      const roomName = room.label_affiche || room.name;
                      const roomType = room.type_piece || room.type;
                      
                      // Trouver l'icône correspondante dans les templates
                      const templateMatch = ROOM_TEMPLATES.find(
                        (t) => (t.name && roomName && t.name.toLowerCase() === roomName.toLowerCase()) ||
                               (t.id && roomType && t.id === roomType)
                      );
                      const Icon = templateMatch?.icon || DoorOpen;
                      return (
                        <motion.div
                          key={room.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleRoomToggle(room.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                isSelected ? "bg-primary/10" : "bg-muted"
                              }`}
                            >
                              <Icon
                                className={`h-5 w-5 ${
                                  isSelected ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">{roomName || "Pièce sans nom"}</span>
                              {(room.surface_m2 || room.surface) && (
                                <span className="text-xs text-muted-foreground">{room.surface_m2 || room.surface} m²</span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary ml-auto" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* Afficher les templates par défaut si pas de pièces configurées */
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {ROOM_TEMPLATES.map((room) => {
                      const Icon = room.icon;
                      const isSelected = selectedRooms.includes(room.id);
                      return (
                        <motion.div
                          key={room.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleRoomToggle(room.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                isSelected ? "bg-primary/10" : "bg-muted"
                              }`}
                            >
                              <Icon
                                className={`h-5 w-5 ${
                                  isSelected ? "text-primary" : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <span className="font-medium">{room.name}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary ml-auto" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  {selectedRooms.length} pièce(s) sélectionnée(s)
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 5: Room-by-Room Inspection */}
          {step === 4 && currentRoom && (
            <div className="space-y-4">
              {/* Room Navigation */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {roomsData.map((room, i) => {
                  const photoCount = getTotalRoomPhotos(room);
                  return (
                    <Button
                      key={i}
                      variant={i === currentRoomIndex ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentRoomIndex(i)}
                      className="shrink-0 relative"
                    >
                      {room.name}
                      {room.items.every((item) => item.condition) && (
                        <Check className="ml-1 h-3 w-3" />
                      )}
                      {photoCount > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100 h-5 px-1.5"
                        >
                          <Camera className="h-3 w-3 mr-1" />
                          {photoCount}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{currentRoom.name}</CardTitle>
                  <CardDescription>
                    Évaluez l&apos;état de chaque élément
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Photos Globales de la pièce */}
                  <div className="p-4 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Camera className="h-4 w-4" />
                          Photos globales de la pièce
                        </h4>
                        <p className="text-xs text-muted-foreground">Vues d&apos;ensemble, points particuliers hors éléments</p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          id={`global-photo-${currentRoomIndex}`}
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleGlobalPhotoUpload(currentRoomIndex, e.target.files)}
                        />
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => document.getElementById(`global-photo-${currentRoomIndex}`)?.click()}
                          className="bg-white hover:bg-slate-50"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Ajouter
                        </Button>
                      </div>
                    </div>

                    {currentRoom.globalPhotos?.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {currentRoom.globalPhotos.map((photo, photoIndex) => (
                          <div key={photoIndex} className="relative group">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt="Global Preview"
                              className="h-20 w-20 object-cover rounded-md border shadow-sm"
                            />
                            <button
                              onClick={() => removeGlobalPhoto(currentRoomIndex, photoIndex)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Éléments détaillés</h4>
                    {currentRoom.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="p-4 rounded-lg border space-y-4 shadow-sm bg-white">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-slate-800">{item.name}</h4>
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            id={`photo-${currentRoomIndex}-${itemIndex}`}
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={(e) => handlePhotoUpload(currentRoomIndex, itemIndex, e.target.files)}
                          />
                          <Button 
                            variant={item.photos.length > 0 ? "outline" : "secondary"} 
                            size="sm"
                            onClick={() => document.getElementById(`photo-${currentRoomIndex}-${itemIndex}`)?.click()}
                            className={item.photos.length === 0 ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" : ""}
                          >
                            <Camera className={`h-4 w-4 mr-1 ${item.photos.length === 0 ? "animate-pulse" : ""}`} />
                            {item.photos.length > 0 ? `Photos (${item.photos.length})` : "Prendre photo"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemFromRoom(currentRoomIndex, itemIndex)}
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                            title="Supprimer cet élément"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                        {/* Aperçu des photos */}
                        {item.photos.length > 0 && (
                          <div className="flex flex-wrap gap-2 py-2">
                            {item.photos.map((photo, photoIndex) => (
                              <div key={photoIndex} className="relative group">
                                <img
                                  src={URL.createObjectURL(photo)}
                                  alt="Preview"
                                  className="h-16 w-16 object-cover rounded-md border"
                                />
                                <button
                                  onClick={() => removePhoto(currentRoomIndex, itemIndex, photoIndex)}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {CONDITION_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() =>
                                updateItemCondition(
                                  currentRoomIndex,
                                  itemIndex,
                                  option.value as any
                                )
                              }
                              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                                item.condition === option.value
                                  ? option.color + " ring-2 ring-offset-2 ring-current"
                                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <Textarea
                          placeholder="Notes ou observations..."
                          value={item.notes}
                          onChange={(e) =>
                            updateItemNotes(currentRoomIndex, itemIndex, e.target.value)
                          }
                          className="h-20"
                        />
                      </div>
                    ))}
                    
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItemToRoom(currentRoomIndex)}
                        className="border-dashed border-2 hover:border-primary hover:text-primary transition-all"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter un élément à cette pièce
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 6: Keys */}
          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Trousseau de clés
                </CardTitle>
                <CardDescription>
                  Listez les clés remises au locataire lors de l&apos;entrée
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {keys.map((keyItem, index) => (
                    <div key={index} className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                          Clé #{index + 1}
                        </div>
                        {keys.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setKeys(prev => prev.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Type de clé</Label>
                          <div className="flex gap-2">
                            <Select
                              value={keyItem.type}
                              onValueChange={(v) => {
                                const newKeys = [...keys];
                                newKeys[index].type = v;
                                setKeys(newKeys);
                              }}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Choisir un type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {DEFAULT_KEY_TYPES.map(t => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                                <SelectItem value="Autre">Autre...</SelectItem>
                              </SelectContent>
                            </Select>
                            {keyItem.type === "Autre" && (
                              <Input 
                                placeholder="Précisez..." 
                                className="bg-white"
                                onChange={(e) => {
                                  // Logic to handle custom type if needed
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantité</Label>
                          <Input
                            type="number"
                            min="1"
                            value={keyItem.count}
                            onChange={(e) => {
                              const newKeys = [...keys];
                              newKeys[index].count = parseInt(e.target.value) || 1;
                              setKeys(newKeys);
                            }}
                            className="bg-white"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Observations (facultatif)</Label>
                        <Input
                          placeholder="Ex: Marque Vachette, un peu usée..."
                          value={keyItem.notes}
                          onChange={(e) => {
                            const newKeys = [...keys];
                            newKeys[index].notes = e.target.value;
                            setKeys(newKeys);
                          }}
                          className="bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setKeys(prev => [...prev, { type: "Clé Porte d'entrée", count: 1, notes: "" }])}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une autre clé
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 7: Summary — Récapitulatif complet */}
          {step === 6 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Résumé de l&apos;état des lieux</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Vérifiez les informations avant de créer l&apos;EDL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6">
                {/* Statistiques globales */}
                {(() => {
                  const totalItems = roomsData.reduce((sum, r) => sum + r.items.length, 0);
                  const evaluatedItems = roomsData.reduce((sum, r) => sum + r.items.filter(i => i.condition).length, 0);
                  const totalPhotos = roomsData.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.photos.length, 0) + (r.globalPhotos?.length || 0), 0);
                  const validMeters = meterReadings.filter(m => m.reading.trim() !== "").length;
                  const validKeys = keys.filter(k => k.type.trim() !== "").length;
                  const completionPercent = totalItems > 0 ? Math.round((evaluatedItems / totalItems) * 100) : 0;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <div className="p-3 rounded-lg bg-blue-50 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-blue-700">{roomsData.length}</p>
                        <p className="text-[10px] sm:text-xs text-blue-600">Pièces</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-green-700">{completionPercent}%</p>
                        <p className="text-[10px] sm:text-xs text-green-600">{evaluatedItems}/{totalItems} évalués</p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-50 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-purple-700">{totalPhotos}</p>
                        <p className="text-[10px] sm:text-xs text-purple-600">Photos</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-amber-700">{validMeters}</p>
                        <p className="text-[10px] sm:text-xs text-amber-600">Compteurs</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Lease Info */}
                <div className="p-3 md:p-4 rounded-lg bg-muted/30 space-y-1 md:space-y-2">
                  <p className="text-xs md:text-sm text-muted-foreground">Logement</p>
                  <p className="font-semibold text-sm md:text-base break-words">
                    {selectedLease?.property.adresse_complete}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {selectedLease?.property.code_postal} {selectedLease?.property.ville}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="p-3 md:p-4 rounded-lg bg-muted/30">
                    <p className="text-xs md:text-sm text-muted-foreground">Type</p>
                    <p className="font-semibold text-sm md:text-base">
                      EDL d&apos;{edlType === "entree" ? "entrée" : "sortie"}
                    </p>
                  </div>
                  <div className="p-3 md:p-4 rounded-lg bg-muted/30">
                    <p className="text-xs md:text-sm text-muted-foreground">Date prévue</p>
                    <p className="font-semibold text-sm md:text-base">
                      {scheduledDate
                        ? new Date(scheduledDate).toLocaleString("fr-FR")
                        : "Non définie"}
                    </p>
                  </div>
                </div>

                {/* Meter Readings Summary */}
                {meterReadings.filter(m => m.reading.trim() !== "").length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Relevés de compteurs ({meterReadings.filter(m => m.reading.trim() !== "").length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {meterReadings.filter(m => m.reading.trim() !== "").map((m, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-50 border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{
                              m.type === "electricity" ? "⚡" :
                              m.type === "gas" ? "🔥" :
                              m.type === "water_hot" ? "🚿" : "💧"
                            }</span>
                            <span className="text-xs sm:text-sm font-medium">
                              {m.type === "electricity" ? "Électricité" :
                               m.type === "gas" ? "Gaz" :
                               m.type === "water_hot" ? "Eau chaude" : "Eau froide"}
                            </span>
                          </div>
                          <span className="text-xs sm:text-sm font-mono font-semibold">{m.reading} {m.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rooms Summary */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Pièces inspectées ({roomsData.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {roomsData.map((room, i) => {
                      const completed = room.items.every((item) => item.condition);
                      const photoCount = room.items.reduce((s, item) => s + item.photos.length, 0) + (room.globalPhotos?.length || 0);
                      return (
                        <Badge
                          key={i}
                          variant={completed ? "default" : "outline"}
                          className={cn(
                            "text-[10px] sm:text-xs",
                            completed ? "bg-green-100 text-green-800" : ""
                          )}
                        >
                          {room.name}
                          {photoCount > 0 && <Camera className="ml-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                          {completed && <Check className="ml-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* General Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm">Observations générales</Label>
                  <Textarea
                    id="notes"
                    placeholder="Ajoutez des notes générales sur l'état du logement..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="h-20 sm:h-24 text-sm"
                  />
                </div>

                {/* Keys Summary */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Trousseau de clés ({keys.filter(k => k.type.trim() !== "").length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {keys.filter(k => k.type.trim() !== "").map((k, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] sm:text-xs">
                        <Key className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                        {k.type} (x{k.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between gap-3 pt-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={step === 0}
          className="flex-1 sm:flex-none"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Précédent</span>
          <span className="sm:hidden">Retour</span>
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()} className="flex-1 sm:flex-none">
            {step === 4 && currentRoomIndex < roomsData.length - 1
              ? "Pièce suivante"
              : "Suivant"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none min-w-[120px] sm:min-w-[160px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création... {uploadProgress}%
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Créer l&apos;EDL
              </>
            )}
          </Button>
        )}
      </div>

      {/* Overlay de progression lors de la création */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-[90%] max-w-md mx-4 border">
            <div className="text-center space-y-5">
              {/* Icône animée */}
              <div className="flex justify-center">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      className="text-primary transition-all duration-300"
                      strokeDasharray={`${uploadProgress * 2.83} 283`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{uploadProgress}%</span>
                  </div>
                </div>
              </div>

              {/* Texte de progression */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {uploadStep || "Création en cours..."}
                </h3>
                {uploadDetails && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {uploadDetails}
                  </p>
                )}
                {/* Indicateur de retry */}
                {isRetrying && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Nouvelle tentative en cours ({retryCount + 1}/3)...
                  </p>
                )}
              </div>

              {/* Barre de progression linéaire */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>

              {/* Message d'avertissement */}
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Ne fermez pas cette page pendant la création
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dialogue de confirmation accessible */}
      <ConfirmDialogComponent />
    </div>
  );
}


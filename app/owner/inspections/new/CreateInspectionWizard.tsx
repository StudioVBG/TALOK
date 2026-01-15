"use client";

import { useState, useCallback, useEffect } from "react";
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
  DoorOpen,
  Bed,
  Sofa,
  UtensilsCrossed,
  Bath,
  Warehouse,
  Car,
  TreePine,
  Plus,
  X,
  Camera,
  Save,
  Loader2,
  Trash2,
  Key,
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

interface Lease {
  id: string;
  type_bail: string;
  statut: string;
  date_debut: string;
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
  };
  tenant_name: string;
}

interface Props {
  leases: Lease[];
  preselectedLeaseId?: string;
}

interface RoomTemplate {
  id: string;
  name: string;
  icon: React.ElementType;
  items: string[];
}

interface RoomData {
  name: string;
  customName?: string;
  items: Array<{
    name: string;
    condition: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais" | null;
    notes: string;
    photos: File[];
  }>;
  globalPhotos: File[];
}

const BASE_ITEMS = [
  "Sol",
  "Murs",
  "Plafond",
  "Fenêtre(s)",
  "Porte",
  "Éclairage",
  "Prises électriques",
  "Radiateur/Chauffage",
];

const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "entree",
    name: "Entrée",
    icon: DoorOpen,
    items: ["Porte d'entrée", "Serrure", "Sonnette/Interphone", ...BASE_ITEMS, "Placard", "Autre"],
  },
  {
    id: "salon",
    name: "Salon / Séjour",
    icon: Sofa,
    items: [...BASE_ITEMS, "Volets/Stores", "Placard", "Autre"],
  },
  {
    id: "cuisine",
    name: "Cuisine",
    icon: UtensilsCrossed,
    items: [...BASE_ITEMS, "Évier", "Robinetterie", "Plan de travail", "Plaques de cuisson", "Four", "Hotte", "Réfrigérateur", "Placards", "Autre"],
  },
  {
    id: "chambre",
    name: "Chambre",
    icon: Bed,
    items: [...BASE_ITEMS, "Volets/Stores", "Placard", "Autre"],
  },
  {
    id: "sdb",
    name: "Salle de bain",
    icon: Bath,
    items: [...BASE_ITEMS, "Baignoire/Douche", "Lavabo", "Robinetterie", "Miroir", "Ventilation", "WC", "Autre"],
  },
  {
    id: "wc",
    name: "WC",
    icon: Bath,
    items: ["Sol", "Murs", "Plafond", "Porte", "Cuvette", "Chasse d'eau", "Lave-mains", "Ventilation", "Éclairage", "Autre"],
  },
  {
    id: "garage",
    name: "Garage / Parking",
    icon: Car,
    items: ["Porte/Accès", ...BASE_ITEMS, "Éclairage", "Autre"],
  },
  {
    id: "cave",
    name: "Cave / Cellier",
    icon: Warehouse,
    items: ["Porte/Accès", ...BASE_ITEMS, "Autre"],
  },
  {
    id: "exterieur",
    name: "Extérieur / Jardin",
    icon: TreePine,
    items: ["Portail/Clôture", "Allées", "Pelouse", "Terrasse", "Éclairage extérieur", "Autre"],
  },
];

const CONDITION_OPTIONS = [
  { value: "neuf", label: "Neuf", color: "bg-blue-100 text-blue-800 border-blue-300" },
  { value: "bon", label: "Bon état", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "moyen", label: "État moyen", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "mauvais", label: "Mauvais état", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "tres_mauvais", label: "Très mauvais", color: "bg-red-100 text-red-800 border-red-300" },
];

const STEPS = [
  { id: "lease", title: "Bail", description: "Sélectionnez le bail concerné" },
  { id: "type", title: "Type", description: "Entrée ou sortie" },
  { id: "meters", title: "Compteurs", description: "Relevés des compteurs" },
  { id: "rooms", title: "Pièces", description: "Sélectionnez les pièces" },
  { id: "inspection", title: "Inspection", description: "Remplissez l'EDL" },
  { id: "keys", title: "Clés", description: "Trousseau de clés" },
  { id: "summary", title: "Résumé", description: "Vérifiez et validez" },
];

// Types de compteurs pour les relevés
interface MeterReading {
  type: "electricity" | "gas" | "water" | "water_hot";
  meterNumber: string;
  reading: string;
  unit: string;
  photo?: File;
}

interface KeyItem {
  type: string;
  count: number;
  notes?: string;
}

const DEFAULT_KEY_TYPES = [
  "Clé Porte d'entrée",
  "Badge Immeuble",
  "Digicode / Code d'accès",
  "Clé Boîte aux lettres",
  "Clé Garage / Parking",
  "Clé Cave",
  "Télécommande Portail",
];

const METER_TYPES = [
  { type: "electricity" as const, label: "Électricité", unit: "kWh", icon: "⚡" },
  { type: "gas" as const, label: "Gaz", unit: "m³", icon: "🔥" },
  { type: "water" as const, label: "Eau froide", unit: "m³", icon: "💧" },
  { type: "water_hot" as const, label: "Eau chaude", unit: "m³", icon: "🚿" },
];

export function CreateInspectionWizard({ leases, preselectedLeaseId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État pour la barre de progression lors de la création
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState("");
  const [uploadDetails, setUploadDetails] = useState("");
  
  // Form state - Auto-select lease if preselectedLeaseId is provided
  const initialLease = preselectedLeaseId 
    ? leases.find(l => l.id === preselectedLeaseId) || null 
    : null;
  const [selectedLease, setSelectedLease] = useState<Lease | null>(initialLease);
  const [edlType, setEdlType] = useState<"entree" | "sortie">("entree");
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [propertyRooms, setPropertyRooms] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  
  // État pour les compteurs
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([
    { type: "electricity", meterNumber: "", reading: "", unit: "kWh" },
    { type: "water", meterNumber: "", reading: "", unit: "m³" },
  ]);

  // État pour les clés
  const [keys, setKeys] = useState<KeyItem[]>([
    { type: "Clé Porte d'entrée", count: 1, notes: "" },
  ]);

  // Auto-avancer si bail présélectionné (depuis lien direct)
  useEffect(() => {
    if (preselectedLeaseId && initialLease && step === 0) {
      // Auto-avancer vers l'étape "Type d'EDL"
      setStep(1);
      toast({
        title: "Bail sélectionné",
        description: `${initialLease.property.adresse_complete} - ${initialLease.tenant_name}`,
      });
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

  const handlePhotoUpload = (roomIndex: number, itemIndex: number, files: FileList | null) => {
    if (!files) return;
    const newPhotos = Array.from(files);
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
    const newPhotos = Array.from(files);
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

      // Helper pour les requêtes avec meilleure gestion d'erreur
      const safeFetch = async (url: string, options?: RequestInit) => {
        try {
          const res = await fetch(url, options);
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `Erreur ${res.status}`);
          }
          return res;
        } catch (err: any) {
          // Améliorer les messages d'erreur réseau
          if (err.message === "Load failed" || err.message === "Failed to fetch") {
            throw new Error("Erreur réseau - vérifiez votre connexion internet");
          }
          throw err;
        }
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
          await safeFetch(`/api/edl/${edl.id}/meter-readings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              meter_id: meterId,
              meter_type: mr.type,
              meter_number: mr.meterNumber,
              reading_value: parseFloat(mr.reading),
              reading_unit: mr.unit,
              photo_path: photoPath,
            }),
          });
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
      if (totalPhotos > 0) {
        setUploadStep("Upload des photos...");
        let uploadedPhotos = 0;
        let itemOffset = 0;
        let totalPhotosUploaded = 0;
        let totalPhotosExpected = 0;

        for (const room of roomsData) {
          // Photos globales de la pièce
          if (room.globalPhotos && room.globalPhotos.length > 0) {
            totalPhotosExpected += room.globalPhotos.length;
            setUploadDetails(`Photo ${uploadedPhotos + 1}/${totalPhotos} (${room.name})`);
            const formData = new FormData();
            room.globalPhotos.forEach(photo => formData.append("files", photo));
            formData.append("section", room.name);

            try {
              const response = await fetch(`/api/inspections/${edl.id}/photos`, {
                method: "POST",
                body: formData,
              });

              if (response.ok) {
                const data = await response.json();
                totalPhotosUploaded += data.files?.length || 0;
              } else {
                console.error(`Erreur upload photos globales ${room.name}:`, await response.text());
              }
            } catch (uploadError) {
              console.error(`Exception upload photos globales ${room.name}:`, uploadError);
            }
            uploadedPhotos += room.globalPhotos.length;
            setUploadProgress(40 + Math.round((uploadedPhotos / totalPhotos) * 55));
          }

          // Photos des items
          for (const item of room.items) {
            const insertedItem = insertedItems[itemOffset];
            if (item.photos.length > 0 && insertedItem) {
              totalPhotosExpected += item.photos.length;
              setUploadDetails(`Photo ${uploadedPhotos + 1}/${totalPhotos} (${item.name})`);
              const formData = new FormData();
              item.photos.forEach(photo => formData.append("files", photo));
              formData.append("section", room.name);

              try {
                const response = await fetch(`/api/inspections/${edl.id}/photos?item_id=${insertedItem.id}`, {
                  method: "POST",
                  body: formData,
                });

                if (response.ok) {
                  const data = await response.json();
                  totalPhotosUploaded += data.files?.length || 0;
                } else {
                  console.error(`Erreur upload photos item ${item.name}:`, await response.text());
                }
              } catch (uploadError) {
                console.error(`Exception upload photos item ${item.name}:`, uploadError);
              }
              uploadedPhotos += item.photos.length;
              setUploadProgress(40 + Math.round((uploadedPhotos / totalPhotos) * 55));
            }
            itemOffset++;
          }
        }

        // Avertir si certaines photos n'ont pas été uploadées
        if (totalPhotosUploaded < totalPhotosExpected) {
          console.warn(`Upload photos: ${totalPhotosUploaded}/${totalPhotosExpected} photos uploadées`);
        }
      }

      setUploadProgress(100);
      setUploadStep("Finalisation...");
      setUploadDetails("");

      toast({
        title: "État des lieux créé",
        description: "L'EDL a été créé avec succès avec tous les relevés et photos.",
      });

      router.push(`/owner/inspections/${edl.id}`);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'EDL",
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
                  <div className="grid gap-4">
                    {leases.map((lease) => (
                      <motion.div
                        key={lease.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedLease(lease)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedLease?.id === lease.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-lg bg-muted">
                            <Home className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{lease.property.adresse_complete}</p>
                            <p className="text-sm text-muted-foreground">
                              {lease.property.code_postal} {lease.property.ville}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {lease.tenant_name}
                              </span>
                            </div>
                          </div>
                          {selectedLease?.id === lease.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold">Aucun bail éligible</h3>
                    <p className="text-muted-foreground">
                      Pour créer un EDL, vous devez avoir un bail :
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
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

          {/* Step 7: Summary */}
          {step === 6 && (
            <Card>
              <CardHeader>
                <CardTitle>Résumé de l&apos;état des lieux</CardTitle>
                <CardDescription>
                  Vérifiez les informations avant de créer l&apos;EDL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-6">
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

                {/* Rooms Summary */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Pièces inspectées ({roomsData.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {roomsData.map((room, i) => {
                      const completed = room.items.every((item) => item.condition);
                      return (
                        <Badge
                          key={i}
                          variant={completed ? "default" : "outline"}
                          className={completed ? "bg-green-100 text-green-800" : ""}
                        >
                          {room.name}
                          {completed && <Check className="ml-1 h-3 w-3" />}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* General Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observations générales</Label>
                  <Textarea
                    id="notes"
                    placeholder="Ajoutez des notes générales sur l'état du logement..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="h-24"
                  />
                </div>

                {/* Keys Summary */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Trousseau de clés ({keys.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {keys.filter(k => k.type.trim() !== "").map((k, i) => (
                      <Badge key={i} variant="secondary">
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


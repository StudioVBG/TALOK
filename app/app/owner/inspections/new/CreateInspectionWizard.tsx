"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
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
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

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
    condition: "bon" | "moyen" | "mauvais" | "tres_mauvais" | null;
    notes: string;
    photos: File[];
  }>;
}

const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "entree",
    name: "Entrée",
    icon: DoorOpen,
    items: ["Porte d'entrée", "Serrure", "Sonnette/Interphone", "Sol", "Murs", "Plafond", "Éclairage", "Prises électriques"],
  },
  {
    id: "salon",
    name: "Salon / Séjour",
    icon: Sofa,
    items: ["Sol", "Murs", "Plafond", "Fenêtres", "Volets/Stores", "Éclairage", "Prises électriques", "Radiateur/Chauffage"],
  },
  {
    id: "cuisine",
    name: "Cuisine",
    icon: UtensilsCrossed,
    items: ["Sol", "Murs", "Plafond", "Fenêtre", "Évier", "Robinetterie", "Plan de travail", "Plaques de cuisson", "Four", "Hotte", "Réfrigérateur", "Placards", "Prises électriques"],
  },
  {
    id: "chambre",
    name: "Chambre",
    icon: Bed,
    items: ["Sol", "Murs", "Plafond", "Fenêtre", "Volets/Stores", "Porte", "Placard/Rangement", "Prises électriques", "Radiateur/Chauffage"],
  },
  {
    id: "sdb",
    name: "Salle de bain",
    icon: Bath,
    items: ["Sol", "Murs", "Plafond", "Porte", "Baignoire/Douche", "Lavabo", "Robinetterie", "Miroir", "WC", "Ventilation", "Prises électriques"],
  },
  {
    id: "wc",
    name: "WC séparés",
    icon: Bath,
    items: ["Sol", "Murs", "Porte", "Cuvette", "Chasse d'eau", "Lave-mains", "Ventilation"],
  },
  {
    id: "garage",
    name: "Garage / Parking",
    icon: Car,
    items: ["Porte/Accès", "Sol", "Murs", "Éclairage", "Prises électriques"],
  },
  {
    id: "cave",
    name: "Cave / Cellier",
    icon: Warehouse,
    items: ["Porte/Accès", "Sol", "Murs", "Éclairage"],
  },
  {
    id: "exterieur",
    name: "Extérieur / Jardin",
    icon: TreePine,
    items: ["Portail/Clôture", "Allées", "Pelouse", "Terrasse", "Éclairage extérieur"],
  },
];

const CONDITION_OPTIONS = [
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

const METER_TYPES = [
  { type: "electricity" as const, label: "Électricité", unit: "kWh", icon: "⚡" },
  { type: "gas" as const, label: "Gaz", unit: "m³", icon: "🔥" },
  { type: "water" as const, label: "Eau froide", unit: "m³", icon: "💧" },
  { type: "water_hot" as const, label: "Eau chaude", unit: "m³", icon: "🚿" },
];

export function CreateInspectionWizard({ leases }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [edlType, setEdlType] = useState<"entree" | "sortie">("entree");
  const [scheduledDate, setScheduledDate] = useState("");
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [roomsData, setRoomsData] = useState<RoomData[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [generalNotes, setGeneralNotes] = useState("");
  
  // État pour les compteurs
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([
    { type: "electricity", meterNumber: "", reading: "", unit: "kWh" },
    { type: "water", meterNumber: "", reading: "", unit: "m³" },
  ]);

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
        return true;
      default:
        return false;
    }
  }, [step, selectedLease, edlType, scheduledDate, meterReadings, selectedRooms.length, roomsData.length]);
  
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

  const initializeRoomsData = () => {
    const rooms: RoomData[] = selectedRooms.map((roomId) => {
      const template = ROOM_TEMPLATES.find((t) => t.id === roomId);
      return {
        name: template?.name || roomId,
        items: (template?.items || []).map((item) => ({
          name: item,
          condition: null,
          notes: "",
          photos: [],
        })),
      };
    });
    setRoomsData(rooms);
    setCurrentRoomIndex(0);
  };

  const handleNext = () => {
    if (step === 3) {
      initializeRoomsData();
    }
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const updateItemCondition = (
    roomIndex: number,
    itemIndex: number,
    condition: "bon" | "moyen" | "mauvais" | "tres_mauvais"
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

  const handleSubmit = async () => {
    if (!selectedLease) return;

    try {
      setIsSubmitting(true);

      // Create EDL with meter readings
      const response = await fetch(`/api/properties/${selectedLease.property.id}/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: edlType,
          scheduled_at: scheduledDate,
          lease_id: selectedLease.id,
          notes: generalNotes,
          meter_readings: meterReadings.filter(m => m.reading.trim() !== ""),
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la création de l'EDL");
      }

      const { edl } = await response.json();

      // Add sections/items
      const sections = roomsData.map((room) => ({
        room_name: room.name,
        items: room.items.map((item) => ({
          room_name: room.name,
          item_name: item.name,
          condition: item.condition,
          notes: item.notes,
        })),
      }));

      await fetch(`/api/edl/${edl.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });

      toast({
        title: "État des lieux créé",
        description: "L'EDL a été créé avec succès. Vous pouvez maintenant le compléter.",
      });

      router.push(`/app/owner/inspections/${edl.id}`);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'EDL",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRoom = roomsData[currentRoomIndex];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nouvel état des lieux</h1>
        <p className="text-muted-foreground">
          Créez un EDL d&apos;entrée ou de sortie en quelques étapes
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                i < step
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === step
                  ? "border-primary text-primary"
                  : "border-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-5 w-5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-12 md:w-24 h-1 mx-2 rounded ${
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
                    <h3 className="font-semibold">Aucun bail actif</h3>
                    <p className="text-muted-foreground">
                      Vous devez avoir un bail actif pour créer un EDL
                    </p>
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
                  className="grid grid-cols-2 gap-4"
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
                      
                      <div className="grid grid-cols-2 gap-4">
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
                          <Input
                            id={`meter-reading-${index}`}
                            type="number"
                            placeholder="Ex: 15234"
                            value={meter.reading}
                            onChange={(e) => updateMeterReading(index, "reading", e.target.value)}
                          />
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
                  Sélectionnez les pièces qui composent le logement
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                {roomsData.map((room, i) => (
                  <Button
                    key={i}
                    variant={i === currentRoomIndex ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentRoomIndex(i)}
                    className="shrink-0"
                  >
                    {room.name}
                    {room.items.every((item) => item.condition) && (
                      <Check className="ml-1 h-3 w-3" />
                    )}
                  </Button>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{currentRoom.name}</CardTitle>
                  <CardDescription>
                    Évaluez l&apos;état de chaque élément
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentRoom.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="p-4 rounded-lg border space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{item.name}</h4>
                        <Button variant="outline" size="sm">
                          <Camera className="h-4 w-4 mr-1" />
                          Photo
                        </Button>
                      </div>
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
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentRoomIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentRoomIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Pièce précédente
                  </Button>
                  <Button
                    onClick={() =>
                      setCurrentRoomIndex((prev) =>
                        Math.min(roomsData.length - 1, prev + 1)
                      )
                    }
                    disabled={currentRoomIndex === roomsData.length - 1}
                  >
                    Pièce suivante
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* Step 6: Summary */}
          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle>Résumé de l&apos;état des lieux</CardTitle>
                <CardDescription>
                  Vérifiez les informations avant de créer l&apos;EDL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Lease Info */}
                <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                  <p className="text-sm text-muted-foreground">Logement</p>
                  <p className="font-semibold">
                    {selectedLease?.property.adresse_complete}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLease?.property.code_postal} {selectedLease?.property.ville}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-semibold">
                      EDL d&apos;{edlType === "entree" ? "entrée" : "sortie"}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm text-muted-foreground">Date prévue</p>
                    <p className="font-semibold">
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
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
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
    </div>
  );
}


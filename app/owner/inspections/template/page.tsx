"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Download,
  Printer,
  ArrowLeft,
  Home,
  Plus,
  X,
  FileText,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { ProtectedRoute } from "@/components/protected-route";
import { EDLPreview } from "@/features/edl";
import { useProfile } from "@/lib/hooks/use-profile";
import type { EDLComplet } from "@/lib/templates/edl/types";
import Link from "next/link";
import { propertiesService } from "@/features/properties/services/properties.service";

/**
 * Page de génération de template EDL vierge
 * Accessible à tous les forfaits (Gratuit, Starter inclus)
 * Permet de télécharger un EDL pré-rempli avec les infos du logement à imprimer
 */

const DEFAULT_ROOMS = [
  { id: "entree", name: "Entrée", selected: true },
  { id: "salon", name: "Salon / Séjour", selected: true },
  { id: "cuisine", name: "Cuisine", selected: true },
  { id: "chambre1", name: "Chambre 1", selected: true },
  { id: "chambre2", name: "Chambre 2", selected: false },
  { id: "chambre3", name: "Chambre 3", selected: false },
  { id: "sdb", name: "Salle de bain", selected: true },
  { id: "wc", name: "WC", selected: true },
  { id: "buanderie", name: "Buanderie", selected: false },
  { id: "garage", name: "Garage / Parking", selected: false },
  { id: "cave", name: "Cave / Cellier", selected: false },
  { id: "jardin", name: "Jardin / Terrasse", selected: false },
];

interface PropertyOption {
  id: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  type: string;
  surface?: number;
  nb_pieces?: number;
  etage?: string;
}

interface LeaseOption {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  date_debut: string;
  property: PropertyOption;
  tenant_name: string;
  tenant_email?: string;
  tenant_phone?: string;
}

export default function EDLTemplatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile, ownerProfile } = useProfile();
  
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [selectedLease, setSelectedLease] = useState<LeaseOption | null>(null);
  const [propertyMeters, setPropertyMeters] = useState<any[]>([]);
  const [edlType, setEdlType] = useState<"entree" | "sortie">("entree");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [customRoom, setCustomRoom] = useState("");
  
  // Charger les baux disponibles
  useEffect(() => {
    async function loadLeases() {
      try {
        // Récupérer les baux avec tous les statuts valides pour un EDL
        const response = await fetch("/api/leases?status=active,fully_signed,pending_signature,partially_signed");
        if (response.ok) {
          const data = await response.json();
          // Mapper les données de l'API vers le format attendu
          const mappedLeases: LeaseOption[] = (data.leases || []).map((lease: any) => {
            const tenantSigner = (lease.signers || []).find(
              (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
            );

            return {
            id: lease.id,
            type_bail: lease.type_bail,
            loyer: lease.loyer || 0,
            charges_forfaitaires: lease.charges_forfaitaires || 0,
            date_debut: lease.date_debut,
            property: {
              id: lease.property?.id || "",
              adresse_complete: lease.property?.adresse_complete || "",
              code_postal: lease.property?.code_postal || "",
              ville: lease.property?.ville || "",
              type: lease.property?.type || "appartement",
              surface: lease.property?.surface_habitable_m2 || lease.property?.surface,
              nb_pieces: lease.property?.nb_pieces,
              etage: lease.property?.etage,
            },
            tenant_name: lease.tenant_name || "Locataire",
              tenant_email: tenantSigner?.profile?.email,
              tenant_phone: tenantSigner?.profile?.telephone,
            };
          });
          setLeases(mappedLeases);
        }
      } catch (error) {
        console.error("Erreur chargement baux:", error);
      } finally {
        setLoading(false);
      }
    }
    loadLeases();
  }, []);

  // Charger les compteurs et les pièces quand le bail est sélectionné
  useEffect(() => {
    async function loadPropertyData() {
      if (selectedLease?.property.id) {
        try {
          // 1. Charger les compteurs
          const metersResponse = await fetch(`/api/properties/${selectedLease.property.id}/meters`);
          if (metersResponse.ok) {
            const data = await metersResponse.json();
            setPropertyMeters(data.meters || []);
          }

          // 2. Charger les pièces réelles du bien
          const roomsData = await propertiesService.listRooms(selectedLease.property.id);
          if (roomsData && roomsData.length > 0) {
            const mappedRooms = roomsData.map(room => ({
              id: room.id,
              name: room.label_affiche || room.type_piece,
              selected: true
            }));
            setRooms(mappedRooms);
          } else {
            setRooms(DEFAULT_ROOMS);
          }
        } catch (error) {
          console.error("Erreur chargement données propriété:", error);
          setRooms(DEFAULT_ROOMS);
        }
      } else {
        setPropertyMeters([]);
        setRooms(DEFAULT_ROOMS);
      }
    }
    loadPropertyData();
  }, [selectedLease]);
  
  // Préparer les données pour l'aperçu
  const edlData: Partial<EDLComplet> = {
    type: edlType,
    scheduled_date: scheduledDate,
    logement: selectedLease?.property ? {
      adresse_complete: selectedLease.property.adresse_complete,
      code_postal: selectedLease.property.code_postal,
      ville: selectedLease.property.ville,
      type_bien: selectedLease.property.type,
      surface: selectedLease.property.surface,
      nb_pieces: selectedLease.property.nb_pieces,
      etage: selectedLease.property.etage,
    } : {
      adresse_complete: "",
      code_postal: "",
      ville: "",
      type_bien: "",
    },
    bailleur: {
      type: ownerProfile?.type || "particulier",
      nom_complet: ownerProfile?.type === "societe"
        ? ownerProfile.raison_sociale || `${profile?.prenom || ""} ${profile?.nom || ""}`.trim()
        : `${profile?.prenom || ""} ${profile?.nom || ""}`.trim() || "Bailleur",
      adresse: ownerProfile?.adresse_facturation || "",
      telephone: profile?.telephone || "",
      email: (profile as any)?.email || "",
      representant: (ownerProfile as any)?.representant_nom || "",
    },
    locataires: selectedLease ? [{
      nom: selectedLease.tenant_name.split(" ").pop() || "",
      prenom: selectedLease.tenant_name.split(" ").slice(0, -1).join(" ") || "",
      nom_complet: selectedLease.tenant_name,
      email: selectedLease.tenant_email || "",
      telephone: selectedLease.tenant_phone || "",
    }] : [],
    bail: selectedLease ? {
      id: selectedLease.id,
      type_bail: selectedLease.type_bail,
      date_debut: selectedLease.date_debut,
      loyer_hc: selectedLease.loyer,
      charges: selectedLease.charges_forfaitaires,
    } : {
      id: "",
      type_bail: "",
      date_debut: "",
      loyer_hc: 0,
      charges: 0,
    },
    compteurs: propertyMeters.map(m => ({
      type: m.type,
      meter_number: m.meter_number || m.serial_number,
      reading: "", // Vide pour remplissage manuel
      unit: m.unit || (m.type === 'electricity' ? 'kWh' : 'm³')
    })),
  };
  
  const selectedRooms = rooms.filter(r => r.selected).map(r => r.name);
  
  const handleRoomToggle = (roomId: string) => {
    setRooms(rooms.map(r => 
      r.id === roomId ? { ...r, selected: !r.selected } : r
    ));
  };
  
  const handleAddCustomRoom = () => {
    if (customRoom.trim()) {
      setRooms([...rooms, { 
        id: `custom_${Date.now()}`, 
        name: customRoom.trim(), 
        selected: true 
      }]);
      setCustomRoom("");
    }
  };
  
  const handleRemoveRoom = (roomId: string) => {
    setRooms(rooms.filter(r => r.id !== roomId));
  };
  
  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }
  
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/owner/inspections">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Template EDL à imprimer
            </h1>
            <p className="text-muted-foreground">
              Générez un état des lieux pré-rempli à imprimer et remplir sur place
            </p>
          </div>
        </div>
        
        {/* Info banner */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="flex items-start gap-3 py-4">
            <ClipboardList className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">
                Fonctionnalité disponible pour tous les forfaits
              </p>
              <p className="text-sm text-blue-700">
                Téléchargez un template EDL adapté à votre logement, imprimez-le et remplissez-le sur place avec votre locataire.
                Pour un EDL 100% numérique avec photos et signature électronique, passez au forfait Confort.
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="space-y-6">
            {/* Sélection du bail */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Sélectionnez le logement
                </CardTitle>
                <CardDescription>
                  Optionnel : les informations du bail seront pré-remplies
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leases.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {leases.map((lease) => (
                      <div
                        key={lease.id}
                        onClick={() => setSelectedLease(
                          selectedLease?.id === lease.id ? null : lease
                        )}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedLease?.id === lease.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <p className="font-medium">{lease.property.adresse_complete}</p>
                            <p className="text-sm text-muted-foreground">
                              {lease.property.code_postal} {lease.property.ville}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Locataire : {lease.tenant_name}
                            </p>
                          </div>
                          {selectedLease?.id === lease.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Aucun bail disponible. Vous pouvez générer un template vierge.
                  </p>
                )}
              </CardContent>
            </Card>
            
            {/* Type et date */}
            <Card>
              <CardHeader>
                <CardTitle>Type d'état des lieux</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={edlType === "entree" ? "default" : "outline"}
                    onClick={() => setEdlType("entree")}
                    className="h-auto py-3"
                  >
                    <div className="text-center">
                      <p className="font-medium">Entrée</p>
                      <p className="text-xs opacity-80">Début de location</p>
                    </div>
                  </Button>
                  <Button
                    variant={edlType === "sortie" ? "destructive" : "outline"}
                    onClick={() => setEdlType("sortie")}
                    className="h-auto py-3"
                  >
                    <div className="text-center">
                      <p className="font-medium">Sortie</p>
                      <p className="text-xs opacity-80">Fin de location</p>
                    </div>
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label>Date prévue</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Sélection des pièces */}
            <Card>
              <CardHeader>
                <CardTitle>Pièces à inspecter</CardTitle>
                <CardDescription>
                  Sélectionnez les pièces qui seront incluses dans le template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className={`flex items-center justify-between p-2 rounded border ${
                        room.selected ? "bg-primary/5 border-primary/30" : "border-border"
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <Checkbox
                          checked={room.selected}
                          onCheckedChange={() => handleRoomToggle(room.id)}
                        />
                        <span className="text-sm">{room.name}</span>
                      </label>
                      {room.id.startsWith("custom_") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleRemoveRoom(room.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Ajouter une pièce personnalisée */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Ajouter une pièce..."
                    value={customRoom}
                    onChange={(e) => setCustomRoom(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustomRoom()}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleAddCustomRoom}
                    disabled={!customRoom.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {selectedRooms.length} pièce(s) sélectionnée(s)
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Aperçu */}
          <div>
            <EDLPreview
              edlData={edlData}
              isVierge={true}
              rooms={selectedRooms}
            />
          </div>
        </div>
      </motion.div>
    </ProtectedRoute>
  );
}


"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Home, Ruler, BedDouble, Bath, Wallet, Edit, Trash2, Share2, Plus, ImageIcon, X, Car, Building2, Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/helpers/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OwnerProperty } from "@/lib/types/owner-property";
import Image from "next/image";
import { EditableText } from "@/components/ui/editable-text";
import { useMutationWithToast } from "@/lib/hooks/use-mutation-with-toast";
import { apiClient } from "@/lib/api-client";

interface PropertyHeroProps {
  property: OwnerProperty;
  activeLease?: any;
  onDelete?: () => void;
  photos?: any[];
  propertyId?: string;
  onPropertyUpdate?: (updatedProperty: OwnerProperty) => void;
}

export function PropertyHero({ property, activeLease, onDelete, photos = [], propertyId, onPropertyUpdate }: PropertyHeroProps) {
  const router = useRouter();
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Mutation pour mise à jour rapide depuis le Hero (titre, ville...)
  const updateProperty = useMutationWithToast({
    mutationFn: async (data: Partial<typeof property>) => {
      if (!propertyId) throw new Error("No ID");
      const response = await apiClient.patch<{ property: typeof property }>(
        `/properties/${propertyId}`,
        data
      );
      return response.property;
    },
    successMessage: "Modification enregistrée",
    errorMessage: "Erreur",
    onSuccess: (updated) => {
      onPropertyUpdate?.(updated);
    },
  });

  const handleUpdateField = useCallback(async (field: string, value: string | number) => {
     await updateProperty.mutateAsync({ [field]: value });
  }, [updateProperty]);

  // Stats adaptées selon le type de bien
  const stats = getPropertyStats(property);

  // ✅ GESTION DE L'ÉTAT "AUCUNE PHOTO"
  if (photos.length === 0) {
    return (
      <div className="relative w-full max-w-7xl mx-auto mb-8">
        <div className="h-[300px] md:h-[400px] rounded-2xl overflow-hidden bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 gap-4 shadow-inner">
          <div className="p-4 bg-white rounded-full shadow-sm">
            <ImageIcon className="w-10 h-10 text-slate-400" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-700">Aucune photo pour le moment</h3>
            <p className="text-sm text-muted-foreground mb-4">Ajoutez des photos pour mettre en valeur votre bien</p>
            {propertyId && (
              <Button 
                onClick={() => router.push(`/app/owner/properties/${propertyId}/edit`)}
                variant="default"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Ajouter des photos
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const mainPhoto = photos.find((p) => p.is_main)?.url || photos[0]?.url || "";
  const otherPhotos = photos.filter((p) => p.url !== mainPhoto).slice(0, 2);
  const remainingCount = Math.max(0, photos.length - 3);

  return (
    <div className="relative w-full max-w-7xl mx-auto mb-8">
      
      {/* Lightbox / Gallery Modal */}
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0 bg-black/95 border-none text-white overflow-hidden flex flex-col">
          <div className="absolute top-4 right-4 z-50">
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
                <X className="h-6 w-6" />
              </Button>
            </DialogClose>
          </div>
          
          <div className="flex-1 relative w-full h-full flex items-center justify-center bg-black">
            {photos.length > 0 && (
              <div className="relative w-full h-full max-h-[80vh]">
                <Image 
                  src={photos[selectedPhotoIndex]?.url || ""} 
                  alt={`Photo ${selectedPhotoIndex + 1}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 80vw"
                  className="object-contain"
                  priority
                />
              </div>
            )}
          </div>

          <div className="h-24 bg-black/50 p-4 flex gap-2 overflow-x-auto">
            {photos.map((photo, idx) => (
              <button
                key={photo.id || idx}
                onClick={() => setSelectedPhotoIndex(idx)}
                className={`relative w-20 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  idx === selectedPhotoIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <Image src={photo.url} alt={`Thumbnail ${idx}`} fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Layout Photos Responsive */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl bg-slate-100">
        {/* Grande photo principale (Mobile: Full width, Desktop: 3/4) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-1 md:col-span-3 relative group cursor-pointer h-full"
          onClick={() => { setSelectedPhotoIndex(0); setIsGalleryOpen(true); }}
        >
          {mainPhoto && (
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(${mainPhoto})` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Contenu sur la photo principale */}
          <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full text-white z-10 pointer-events-none">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="pointer-events-auto" // Réactive les clics pour les inputs
            >
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                <Badge className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border-0 px-3 py-1 text-xs md:text-sm font-medium uppercase tracking-wide">
                  {property.type}
                </Badge>
                {activeLease ? (
                  <Badge className="bg-green-500/90 backdrop-blur-sm text-white border-0">Loué</Badge>
                ) : (
                  <Badge className="bg-slate-500/50 backdrop-blur-sm text-white border-0">Vacant</Badge>
                )}
              </div>
              
              {/* Titre / Adresse éditable */}
              <div className="mb-2 max-w-2xl">
                 <EditableText
                    value={property.adresse_complete}
                    onSave={(val) => handleUpdateField("adresse_complete", val)}
                    className="text-2xl md:text-4xl lg:text-5xl font-bold drop-shadow-lg tracking-tight leading-tight text-white hover:bg-white/10 hover:backdrop-blur-sm rounded px-2 -ml-2 transition-all"
                    inputClassName="text-black text-xl font-normal bg-white/95 backdrop-blur"
                    placeholder="Adresse du bien"
                 />
              </div>

              {/* Sous-titre Ville / CP éditable */}
              <div className="flex items-center text-slate-200 text-sm md:text-lg font-medium max-w-md">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 mr-2 flex-shrink-0" />
                <div className="flex gap-2">
                    <EditableText
                        value={property.code_postal}
                        onSave={(val) => handleUpdateField("code_postal", val)}
                        className="hover:bg-white/10 hover:backdrop-blur-sm rounded px-1 -ml-1"
                        inputClassName="text-black w-24 h-8 py-1 bg-white/95 backdrop-blur"
                        placeholder="CP"
                    />
                    <EditableText
                        value={property.ville}
                        onSave={(val) => handleUpdateField("ville", val)}
                        className="hover:bg-white/10 hover:backdrop-blur-sm rounded px-1"
                        inputClassName="text-black w-40 h-8 py-1 bg-white/95 backdrop-blur"
                        placeholder="Ville"
                    />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bouton Galerie Mobile */}
          <div className="absolute top-4 right-4 md:hidden z-20">
            <Button 
              size="sm" 
              variant="secondary" 
              className="bg-black/50 backdrop-blur-md text-white border-none hover:bg-black/70"
              onClick={(e) => { e.stopPropagation(); setIsGalleryOpen(true); }}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              {photos.length}
            </Button>
          </div>
        </motion.div>

        {/* Colonne de droite (Desktop Only) : Photos secondaires */}
        <div className="hidden md:flex flex-col gap-4 col-span-1 h-full">
          {otherPhotos.map((photo, idx) => (
            <motion.div
              key={photo.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="flex-1 relative rounded-xl overflow-hidden group cursor-pointer"
              onClick={() => { 
                const realIndex = photos.findIndex(p => p.url === photo.url);
                setSelectedPhotoIndex(realIndex !== -1 ? realIndex : 0);
                setIsGalleryOpen(true); 
              }}
            >
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                style={{ backgroundImage: `url(${photo.url})` }}
              />
              {/* Overlay +N photos sur la dernière */}
              {idx === 1 && remainingCount > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">+{remainingCount}</span>
                </div>
              )}
            </motion.div>
          ))}
          
          {/* Carte de statistiques Loyer */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="flex-1 bg-white/80 backdrop-blur-lg border border-white/20 p-6 rounded-xl flex flex-col justify-center items-center shadow-sm hover:shadow-md transition-all"
          >
            <div className="text-center w-full">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Loyer estimé</p>
              
              <div className="flex justify-center">
                <EditableText
                    value={property.loyer_hc}
                    type="currency"
                    onSave={(val) => handleUpdateField("loyer_hc", parseFloat(val))}
                    className="text-2xl font-bold text-slate-900 tracking-tight hover:bg-slate-100 rounded px-2 -mx-2"
                    inputClassName="text-center font-bold text-lg h-10"
                />
              </div>
              <span className="text-xs text-slate-400 font-normal block -mt-1 mb-1">/mois (HC)</span>

              {((property as any).charges_mensuelles || 0) > 0 && (
                 <div className="flex justify-center items-center gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">+</span>
                    <EditableText
                        value={(property as any).charges_mensuelles}
                        type="currency"
                        onSave={(val) => handleUpdateField("charges_mensuelles", parseFloat(val))}
                        className="text-[10px] text-muted-foreground hover:bg-slate-100 px-1 rounded"
                        inputClassName="h-6 w-20 text-xs"
                    />
                     <span className="text-[10px] text-muted-foreground">charges</span>
                 </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * Retourne les statistiques pertinentes selon le type de bien
 */
function getPropertyStats(property: OwnerProperty) {
  const propertyType = property.type || "";
  const propertyAny = property as any;

  // Parking : Surface + Type de parking
  if (propertyType === "parking") {
    const parkingTypeLabels: Record<string, string> = {
      box: "Box fermé",
      couvert: "Couvert",
      exterieur: "Extérieur",
    };
    return [
      { icon: Ruler, label: "Surface", value: property.surface ? `${property.surface} m²` : "—" },
      { icon: Car, label: "Type", value: parkingTypeLabels[propertyAny.parking_type] || "Standard" },
    ];
  }

  // Commercial / Bureau : Surface + Étage
  if (propertyType === "commercial" || propertyType === "bureau") {
    const etageLabel = propertyAny.etage === 0 ? "RDC" : propertyAny.etage ? `${propertyAny.etage}e` : "—";
    return [
      { icon: Ruler, label: "Surface", value: property.surface ? `${property.surface} m²` : "—" },
      { icon: Building2, label: "Étage", value: etageLabel },
    ];
  }

  // Logements (appartement, maison, colocation, saisonnier) : Surface + Pièces + Chambres
  return [
    { icon: Ruler, label: "Surface", value: property.surface ? `${property.surface} m²` : "—" },
    { icon: Home, label: "Pièces", value: property.nb_pieces ? `${property.nb_pieces} p.` : "—" },
    { icon: BedDouble, label: "Chambres", value: propertyAny.nb_chambres ? `${propertyAny.nb_chambres} ch.` : "—" },
  ];
}

function getDPEColor(grade: string) {
  const colors: Record<string, string> = {
    A: "bg-green-500",
    B: "bg-green-400",
    C: "bg-lime-400",
    D: "bg-yellow-400",
    E: "bg-orange-400",
    F: "bg-orange-500",
    G: "bg-red-600",
  };
  return colors[grade] || "bg-slate-400";
}

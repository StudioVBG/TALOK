"use client";
// @ts-nocheck

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { EDLConductor, type EDLData, type EDLRoom, type EDLPhoto } from "@/features/end-of-lease/components/edl-conductor";

interface EDLApiResponse {
  id: string;
  type: "entree" | "sortie";
  status: "draft" | "in_progress" | "completed" | "signed";
  scheduled_date?: string;
  lease: {
    id: string;
    property: {
      id: string;
      adresse_complete: string;
      ville: string;
      code_postal: string;
    };
  };
  items: Array<{
    id: string;
    room_name: string;
    item_name: string;
    condition?: string;
    notes?: string;
  }>;
  media: Array<{
    id: string;
    item_id?: string;
    storage_path: string;
    media_type: string;
    taken_at: string;
    section?: string;
  }>;
}

interface RoomsApiResponse {
  rooms: Array<{
    id: string;
    type_piece: string;
    label_affiche: string;
    surface_m2?: number;
  }>;
}

// Nombre minimum de photos requis par type de pièce
const REQUIRED_PHOTOS_BY_TYPE: Record<string, number> = {
  sejour: 4,
  salon: 4,
  cuisine: 5,
  chambre: 3,
  salle_de_bain: 4,
  wc: 2,
  toilettes: 2,
  entree: 2,
  couloir: 2,
  balcon: 2,
  terrasse: 2,
  cave: 2,
  garage: 2,
  parking: 1,
  bureau: 3,
  buanderie: 2,
  cellier: 2,
  dressing: 2,
  autre: 2,
};

export default function EDLPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const edlId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [edlData, setEdlData] = useState<EDLData | null>(null);

  // Charger les données de l'EDL
  useEffect(() => {
    loadData();
  }, [edlId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger l'EDL
      const edlResponse = await apiClient.get<EDLApiResponse>(`/edl/${edlId}`);
      
      if (!edlResponse || !edlResponse.lease?.property) {
        throw new Error("EDL non trouvé");
      }

      const propertyId = edlResponse.lease.property.id;

      // Charger les pièces du logement
      let rooms: EDLRoom[] = [];
      try {
        const roomsResponse = await apiClient.get<RoomsApiResponse>(`/properties/${propertyId}/rooms`);
        rooms = (roomsResponse.rooms || []).map((room) => ({
          id: room.id,
          name: room.label_affiche,
          type: room.type_piece,
          requiredPhotos: REQUIRED_PHOTOS_BY_TYPE[room.type_piece] || 2,
        }));
      } catch (e) {
        // Si pas de pièces définies, créer des pièces par défaut basées sur les items EDL
        const uniqueRooms = [...new Set(edlResponse.items.map((item) => item.room_name))];
        rooms = uniqueRooms.map((roomName, index) => ({
          id: `room-${index}`,
          name: roomName,
          type: guessRoomType(roomName),
          requiredPhotos: 2,
        }));
      }

      // Si toujours pas de pièces, créer des pièces par défaut
      if (rooms.length === 0) {
        rooms = [
          { id: "default-sejour", name: "Séjour", type: "sejour", requiredPhotos: 4 },
          { id: "default-cuisine", name: "Cuisine", type: "cuisine", requiredPhotos: 5 },
          { id: "default-chambre", name: "Chambre", type: "chambre", requiredPhotos: 3 },
          { id: "default-sdb", name: "Salle de bain", type: "salle_de_bain", requiredPhotos: 4 },
          { id: "default-wc", name: "WC", type: "wc", requiredPhotos: 2 },
        ];
      }

      // Transformer les médias en photos
      const photos: EDLPhoto[] = (edlResponse.media || []).map((media) => ({
        id: media.id,
        url: getPublicUrl(media.storage_path),
        roomId: media.section || findRoomIdForMedia(media, edlResponse.items, rooms),
        uploadedAt: media.taken_at,
      }));

      // Si EDL de sortie, charger l'EDL d'entrée pour comparaison
      let entryPhotos: EDLPhoto[] = [];
      if (edlResponse.type === "sortie") {
        try {
          const entryResponse = await apiClient.get<{ edl: EDLApiResponse }>(
            `/leases/${edlResponse.lease.id}/edl?type=entree`
          );
          if (entryResponse.edl?.media) {
            entryPhotos = entryResponse.edl.media.map((media) => ({
              id: media.id,
              url: getPublicUrl(media.storage_path),
              roomId: media.section || findRoomIdForMedia(media, entryResponse.edl.items, rooms),
              uploadedAt: media.taken_at,
            }));
          }
        } catch (e) {
          console.log("Pas d'EDL d'entrée trouvé");
        }
      }

      const data: EDLData = {
        id: edlResponse.id,
        type: edlResponse.type,
        status: edlResponse.status,
        propertyAddress: `${edlResponse.lease.property.adresse_complete}, ${edlResponse.lease.property.code_postal} ${edlResponse.lease.property.ville}`,
        rooms,
        photos,
        entryPhotos: entryPhotos.length > 0 ? entryPhotos : undefined,
      };

      setEdlData(data);
    } catch (error: unknown) {
      console.error("Erreur chargement EDL:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger l'état des lieux",
        variant: "destructive",
      });
      router.push("/owner/inspections");
    } finally {
      setLoading(false);
    }
  };

  // Upload des photos
  const handlePhotosUpload = useCallback(async (
    photos: Array<{ file: File; roomId: string }>
  ): Promise<EDLPhoto[]> => {
    const uploadedPhotos: EDLPhoto[] = [];

    for (const { file, roomId } of photos) {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("section", roomId);

      const response = await fetch(`/api/inspections/${edlId}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur upload");
      }

      const data = await response.json();
      
      for (const media of data.files || []) {
        uploadedPhotos.push({
          id: media.id,
          url: getPublicUrl(media.file_url || media.storage_path),
          roomId,
          uploadedAt: new Date().toISOString(),
        });
      }
    }

    // Mettre à jour l'état local
    setEdlData((prev) => prev ? {
      ...prev,
      photos: [...prev.photos, ...uploadedPhotos],
    } : null);

    toast({
      title: "Photos ajoutées",
      description: `${uploadedPhotos.length} photo(s) uploadée(s) avec succès`,
    });

    return uploadedPhotos;
  }, [edlId, toast]);

  // Supprimer une photo
  const handlePhotoDelete = useCallback(async (photoId: string) => {
    try {
      await apiClient.delete(`/edl-media/${photoId}`);
      
      setEdlData((prev) => prev ? {
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      } : null);

      toast({
        title: "Photo supprimée",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la photo",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Déplacer une photo vers une autre pièce
  const handlePhotoMove = useCallback(async (photoId: string, newRoomId: string) => {
    try {
      await apiClient.patch(`/edl-media/${photoId}`, { section: newRoomId });
      
      setEdlData((prev) => prev ? {
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photoId ? { ...p, roomId: newRoomId } : p
        ),
      } : null);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de déplacer la photo",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Réordonner les photos
  const handlePhotoReorder = useCallback(async (roomId: string, newOrder: string[]) => {
    // Mise à jour optimiste
    setEdlData((prev) => {
      if (!prev) return null;
      
      const roomPhotos = prev.photos.filter((p) => p.roomId === roomId);
      const otherPhotos = prev.photos.filter((p) => p.roomId !== roomId);
      
      const reorderedPhotos = newOrder
        .map((id) => roomPhotos.find((p) => p.id === id))
        .filter(Boolean) as EDLPhoto[];
      
      return {
        ...prev,
        photos: [...otherPhotos, ...reorderedPhotos],
      };
    });

    // TODO: Persister l'ordre côté serveur si nécessaire
  }, []);

  // Sauvegarder
  const handleSave = useCallback(async () => {
    toast({
      title: "Sauvegardé",
      description: "Vos modifications ont été enregistrées",
    });
  }, [toast]);

  // Finaliser
  const handleFinalize = useCallback(async () => {
    try {
      await apiClient.patch(`/edl/${edlId}`, { status: "completed" });
      
      toast({
        title: "État des lieux finalisé",
        description: "L'état des lieux est prêt pour signature",
      });
      
      router.push(`/owner/inspections/${edlId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de finaliser l'état des lieux",
        variant: "destructive",
      });
    }
  }, [edlId, router, toast]);

  // Retour
  const handleBack = useCallback(() => {
    router.push(`/owner/inspections/${edlId}`);
  }, [edlId, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-muted-foreground">Chargement de l'état des lieux...</p>
        </div>
      </div>
    );
  }

  if (!edlData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">État des lieux non trouvé</p>
      </div>
    );
  }

  return (
    <EDLConductor
      edlData={edlData}
      onPhotosUpload={handlePhotosUpload}
      onPhotoDelete={handlePhotoDelete}
      onPhotoMove={handlePhotoMove}
      onPhotoReorder={handlePhotoReorder}
      onSave={handleSave}
      onFinalize={handleFinalize}
      onBack={handleBack}
      className="h-screen"
    />
  );
}

// ==================== HELPERS ====================

function getPublicUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return storagePath;
  
  return `${supabaseUrl}/storage/v1/object/public/documents/${storagePath}`;
}

function guessRoomType(roomName: string): string {
  const lower = roomName.toLowerCase();
  if (lower.includes("séjour") || lower.includes("salon") || lower.includes("living")) return "sejour";
  if (lower.includes("cuisine")) return "cuisine";
  if (lower.includes("chambre")) return "chambre";
  if (lower.includes("salle de bain") || lower.includes("sdb")) return "salle_de_bain";
  if (lower.includes("wc") || lower.includes("toilette")) return "wc";
  if (lower.includes("entrée") || lower.includes("hall")) return "entree";
  if (lower.includes("couloir")) return "couloir";
  if (lower.includes("balcon")) return "balcon";
  if (lower.includes("terrasse")) return "terrasse";
  if (lower.includes("cave")) return "cave";
  if (lower.includes("garage")) return "garage";
  if (lower.includes("bureau")) return "bureau";
  return "autre";
}

function findRoomIdForMedia(
  media: { item_id?: string; section?: string },
  items: Array<{ id: string; room_name: string }>,
  rooms: EDLRoom[]
): string {
  if (media.section) return media.section;
  
  if (media.item_id) {
    const item = items.find((i) => i.id === media.item_id);
    if (item) {
      const room = rooms.find((r) => r.name === item.room_name);
      if (room) return room.id;
    }
  }
  
  return rooms[0]?.id || "unknown";
}


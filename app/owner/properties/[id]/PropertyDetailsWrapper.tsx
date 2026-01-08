"use client";

/**
 * PropertyDetailsWrapper - Vue Owner avec mode édition
 * Utilise PropertyDetailsView pour la lecture et le composant d'édition existant
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useMutationWithToast } from "@/lib/hooks/use-mutation-with-toast";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Edit, 
  X, 
  Check, 
  Loader2,
  Trash2,
  FolderOpen,
  Video
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/components/ui/use-toast";

// Composant partagé de visualisation
import { 
  PropertyDetailsView,
  type PropertyData,
  type PropertyPhoto,
  type PropertyLease,
} from "@/components/properties";

// Types
import type { PropertyDetails } from "../../_data/fetchPropertyDetails";

// ============================================
// TYPES
// ============================================

interface PropertyDetailsWrapperProps {
  details: PropertyDetails;
  propertyId: string;
}

// ============================================
// ACTIONS OWNER
// ============================================

function OwnerActions({ 
  propertyId, 
  onEditClick,
  onDeleteClick,
  hasVirtualTour,
  virtualTourUrl,
}: { 
  propertyId: string; 
  onEditClick: () => void;
  onDeleteClick: () => void;
  hasVirtualTour: boolean;
  virtualTourUrl?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground">Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button 
          onClick={onEditClick}
          variant="default" 
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Modifier le bien
        </Button>
        
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href={`/owner/documents?property_id=${propertyId}`}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Gérer les documents
          </Link>
        </Button>

        {hasVirtualTour && virtualTourUrl && (
          <Button asChild variant="outline" className="w-full justify-start">
            <a href={virtualTourUrl} target="_blank" rel="noopener noreferrer">
              <Video className="mr-2 h-4 w-4" />
              Visite virtuelle
            </a>
          </Button>
        )}
        
        <Button 
          variant="outline" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
          onClick={onDeleteClick}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer le bien
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export function PropertyDetailsWrapper({ 
  details, 
  propertyId 
}: PropertyDetailsWrapperProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Transformer les données pour PropertyDetailsView
  const property = details.property as unknown as PropertyData;
  const photos = (details.photos || []) as PropertyPhoto[];
  
  // Chercher un bail existant
  const leases = details.leases || [];
  const existingLease = leases.find((l: any) => 
    ["active", "pending_signature", "draft"].includes(l.statut)
  );
  const lease = existingLease as PropertyLease | undefined;

  // Mutation pour la suppression
  const deleteProperty = useMutationWithToast({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/properties/${id}`);
    },
    successMessage: "Bien supprimé avec succès",
    errorMessage: "Impossible de supprimer le bien.",
    invalidateQueries: ["properties"],
    onSuccess: () => {
      router.push("/owner/properties");
    },
  });

  const handleDelete = () => {
    deleteProperty.mutate(propertyId);
  };

  const handleEditClick = () => {
    // Rediriger vers le mode édition complet
    router.push(`/owner/properties/${propertyId}/edit`);
  };

  // Mode lecture - utilise le composant partagé
  return (
    <>
      <PropertyDetailsView
        // Données
        property={property}
        photos={photos}
        lease={lease}
        
        // Configuration Owner
        viewerRole="owner"
        
        // Visibilité
        showPhotos={true}
        showMap={true}
        showCharacteristics={true}
        showOccupation={true}
        showFinancials={true}
        showMeters={true}
        showOwnerInfo={false} // L'owner ne voit pas ses propres infos
        showVirtualTour={true}
        
        // Permissions Owner
        canEdit={true}
        canDelete={true}
        canCreateLease={true}
        
        // URLs Owner
        backHref="/owner/properties"
        backLabel="Retour à la liste"
        editHref={`/owner/properties/${propertyId}/edit`}
        createLeaseHref={`/owner/leases/new?propertyId=${propertyId}`}
        viewLeaseHref={(leaseId) => `/owner/leases/${leaseId}`}
        
        // Slot owner - Actions personnalisées
        sidebarSlot={
          <OwnerActions 
            propertyId={propertyId}
            onEditClick={handleEditClick}
            onDeleteClick={() => setDeleteDialogOpen(true)}
            hasVirtualTour={!!property.visite_virtuelle_url}
            virtualTourUrl={property.visite_virtuelle_url}
          />
        }
      />

      {/* Dialog de suppression */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer ce bien ?"
        description={`Cette action est irréversible. Le bien "${property?.adresse_complete}" sera supprimé.`}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteProperty.isPending}
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
      />
    </>
  );
}


"use client";

/**
 * Admin - Détail d'une propriété
 * Utilise PropertyDetailsView avec configuration admin
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Loader2,
  AlertTriangle, 
  Shield,
  History,
  Flag
} from "lucide-react";

// Composant partagé
import { 
  PropertyDetailsView,
  type PropertyData,
  type PropertyPhoto,
  type PropertyLease,
  type PropertyOwner
} from "@/components/properties";

// ============================================
// TYPES
// ============================================

interface AdminPropertyData {
  property: PropertyData;
  photos: PropertyPhoto[];
  owner: PropertyOwner | null;
  current_lease: PropertyLease | null;
}

// ============================================
// COMPOSANTS ADMIN SPÉCIFIQUES
// ============================================

function AdminActions({ propertyId }: { propertyId: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-medium text-foreground mb-3">Actions Admin</p>
        
        <Button variant="outline" size="sm" className="w-full justify-start" asChild>
          <Link href={`/admin/properties/${propertyId}/history`}>
            <History className="mr-2 h-4 w-4" />
            Historique des modifications
          </Link>
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-500/10"
        >
          <Flag className="mr-2 h-4 w-4" />
          Signaler un problème
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <Shield className="mr-2 h-4 w-4" />
          Suspendre le bien
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        <Skeleton className="h-[450px] w-full rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Card className="bg-card border-border">
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Propriété introuvable
          </h3>
          <p className="text-muted-foreground mb-6">
            Cette propriété n'existe pas ou a été supprimée.
          </p>
          <Button asChild>
            <Link href="/admin/properties">Retour aux propriétés</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function AdminPropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;

  const [data, setData] = useState<AdminPropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProperty() {
      try {
        setLoading(true);
        setError(null);
        
        // Récupérer les données de la propriété
        const response = await fetch(`/api/admin/properties/${propertyId}`, {
          credentials: "include",
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setData(null);
            return;
          }
          throw new Error("Erreur lors du chargement");
        }
        
        const result = await response.json();
        
        // Récupérer les photos
        let photos: PropertyPhoto[] = [];
        try {
          const photosResponse = await fetch(`/api/properties/${propertyId}/photos`, {
            credentials: "include",
          });
          if (photosResponse.ok) {
            const photosData = await photosResponse.json();
            photos = photosData.photos || [];
          }
        } catch (e) {
          console.log("Pas de photos disponibles");
        }
        
        setData({
          property: result.property || result,
          photos,
          owner: result.owner || null,
          current_lease: result.current_lease || null,
        });
        
      } catch (err) {
        console.error("Erreur chargement propriété:", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    }
    
    if (propertyId) {
      fetchProperty();
    }
  }, [propertyId]);

  // États de chargement
  if (loading) {
    return <LoadingState />;
  }

  // Propriété non trouvée
  if (!data?.property) {
    return <NotFoundState />;
  }

  // Erreur
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Erreur</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => router.refresh()}>Réessayer</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PropertyDetailsView
      // Données
      property={data.property}
      photos={data.photos}
      lease={data.current_lease}
      owner={data.owner}
      
      // Configuration Admin
      viewerRole="admin"
      
      // Visibilité - Admin voit tout
      showPhotos={true}
      showMap={true}
      showCharacteristics={true}
      showOccupation={true}
      showFinancials={true}
      showMeters={true}
      showOwnerInfo={true}
      showVirtualTour={true}
      
      // Permissions Admin
      canEdit={true}
      canDelete={false} // L'admin ne supprime pas directement
      canCreateLease={false} // Seul le propriétaire crée des baux
      
      // URLs Admin
      backHref="/admin/properties"
      backLabel="Retour aux propriétés"
      editHref={`/admin/properties/${propertyId}/edit`}
      ownerProfileHref={data.owner ? `/admin/people/owners/${data.owner.id}` : undefined}
      viewLeaseHref={(leaseId) => `/admin/leases/${leaseId}`}
      
      // Slot admin - Actions de modération
      sidebarSlot={<AdminActions propertyId={propertyId} />}
    />
  );
}


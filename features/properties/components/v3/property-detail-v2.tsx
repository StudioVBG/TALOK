/**
 * PropertyDetailV2 - Fiche propriété V2.5 avec layout dashboard-like
 * 
 * Sources :
 * - Modèle V3 section 6 : Fiche logement propriétaire /properties/:id
 * - Design SOTA 2025 : Layout dashboard-like avec header, résumé, tabs adaptatives
 * 
 * Structure :
 * - Header avec titre, badges, actions rapides
 * - Bloc résumé avec informations clés
 * - 3 tabs principales :
 *   1. Gestion & contrat (baux, locataires, loyers, documents, montants éditables)
 *   2. Pièces & photos (liste rooms + galerie, photos non classées)
 *   3. Annonce & expérience locataire (cards complètes + complétion)
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Home,
  Building2,
  Car,
  Euro,
  Edit,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Receipt,
  Users,
  Calendar,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
  Building,
  Key,
  FileCheck,
  AlertTriangle,
  Settings,
  Camera,
  FileEdit,
  Globe,
  Star,
  Bed,
  Lock,
  Clock,
  Map,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import { propertiesService } from "@/features/properties/services/properties.service";
import { CLASSES_EXTENDED, SHADOWS, GRADIENTS } from "@/lib/design-system/design-tokens";
import { containerVariants, itemVariants } from "@/lib/design-system/animations";
import { PropertyDetailHeader } from "./property-detail-header";
import { PropertyDetailSummary } from "./property-detail-summary";
import { PropertyManagementTab } from "./property-management-tab";
import { PropertyRoomsPhotosTab } from "./property-rooms-photos-tab";
import { PropertyAnnouncementTab } from "./property-announcement-tab";

const TYPE_LABELS: Record<string, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  local_commercial: "Local commercial",
  bureaux: "Bureaux",
  entrepot: "Entrepôt",
  parking: "Parking",
  box: "Box",
  fonds_de_commerce: "Fonds de commerce",
};

const TYPE_ICONS: Record<string, any> = {
  appartement: Building2,
  maison: Home,
  studio: Home,
  colocation: Building2,
  saisonnier: Home,
  local_commercial: Building2,
  bureaux: Building,
  entrepot: Building2,
  parking: Car,
  box: Car,
  fonds_de_commerce: Building2,
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  draft: { label: "Brouillon", variant: "secondary", icon: FileText },
  pending: { label: "En attente", variant: "outline", icon: AlertCircle },
  pending_review: { label: "En attente de validation", variant: "outline", icon: AlertCircle },
  published: { label: "Publié", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejeté", variant: "destructive", icon: AlertTriangle },
  archived: { label: "Archivé", variant: "outline", icon: FileText },
};

interface PropertyDetailV2Props {
  propertyId: string;
}

export function PropertyDetailV2({ propertyId }: PropertyDetailV2Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("management");

  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  async function fetchProperty() {
    try {
      setLoading(true);
      const data = await propertiesService.getPropertyById(propertyId);
      setProperty(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger le logement.",
        variant: "destructive",
      });
      router.push("/properties");
    } finally {
      setLoading(false);
    }
  }

  const handlePropertyUpdate = async (updates: Partial<Property>) => {
    try {
      const updated = await propertiesService.updatePropertyGeneral(propertyId, updates as any);
      setProperty(updated);
      toast({
        title: "Succès",
        description: "Les modifications ont été enregistrées.",
      });
    } catch (error: unknown) {
      // Propager l'erreur pour que les composants enfants puissent la gérer
      // (notamment pour active_lease_blocking dans PropertyAnnouncementTab)
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-lg text-muted-foreground">Chargement du bien...</p>
        </motion.div>
      </div>
    );
  }

  if (!property) {
    return null;
  }

  const TypeIcon = TYPE_ICONS[property.type] || Home;
  const statusConfig = STATUS_CONFIG[property.etat] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(property.type);
  const isParking = ["parking", "box"].includes(property.type);
  const isCommercial = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(property.type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header avec titre, badges, actions */}
      <PropertyDetailHeader
        property={property}
        TypeIcon={TypeIcon}
        statusConfig={statusConfig}
        StatusIcon={StatusIcon}
        onEdit={() => router.push(`/properties/${property.id}/edit`)}
        onBack={() => router.push("/properties")}
      />

      {/* Bloc résumé avec informations clés */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 -mt-16 relative z-10">
        <PropertyDetailSummary property={property} isHabitation={isHabitation} />
      </div>

      {/* Tabs principales */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="management" className="data-[state=active]:bg-background">
              <Settings className="h-4 w-4 mr-2" />
              Gestion & contrat
            </TabsTrigger>
            <TabsTrigger value="rooms-photos" className="data-[state=active]:bg-background">
              <Camera className="h-4 w-4 mr-2" />
              Pièces & photos
            </TabsTrigger>
            <TabsTrigger value="announcement" className="data-[state=active]:bg-background">
              <Globe className="h-4 w-4 mr-2" />
              Annonce & expérience locataire
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Gestion & contrat */}
          <TabsContent value="management" className="space-y-6 mt-6">
            <PropertyManagementTab
              property={property}
              onPropertyUpdate={handlePropertyUpdate}
            />
          </TabsContent>

          {/* Tab 2: Pièces & photos */}
          <TabsContent value="rooms-photos" className="space-y-6 mt-6">
            <PropertyRoomsPhotosTab
              propertyId={propertyId}
              property={property}
              isHabitation={isHabitation}
            />
          </TabsContent>

          {/* Tab 3: Annonce & expérience locataire */}
          <TabsContent value="announcement" className="space-y-6 mt-6">
            <PropertyAnnouncementTab
              property={property}
              onPropertyUpdate={handlePropertyUpdate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


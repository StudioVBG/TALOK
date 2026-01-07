"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, 
  Home, 
  Building2, 
  Car, 
  Euro, 
  Calendar,
  Edit,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Info,
  FileText,
  Image as ImageIcon,
  Wrench,
  Receipt,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Droplet,
  Wind,
  Snowflake,
  Sun,
  Building,
  Layers,
  Key,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import { propertiesService } from "@/features/properties/services/properties.service";
import { CLASSES_EXTENDED, SHADOWS, GRADIENTS, FOCUS_STATES } from "@/lib/design-system/design-tokens";
import { stepTransitionVariants, containerVariants, itemVariants, cardVariants } from "@/lib/design-system/animations";
import { LeasesList } from "@/features/leases/components/leases-list";
import { TicketsList } from "@/features/tickets/components/tickets-list";
import { DocumentGalleryManager } from "@/features/documents/components/document-gallery-manager";
import { ChargesList } from "@/features/billing/components/charges-list";

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
  published: { label: "Publié", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejeté", variant: "destructive", icon: AlertTriangle },
  archived: { label: "Archivé", variant: "outline", icon: FileText },
};

interface PropertyDetailPremiumProps {
  propertyId: string;
}

export function PropertyDetailPremium({ propertyId }: PropertyDetailPremiumProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  async function fetchProperty() {
    try {
      setLoading(true);
      const data = await propertiesService.getPropertyById(propertyId);
      setProperty(data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger le logement.",
        variant: "destructive",
      });
      router.push("/properties");
    } finally {
      setLoading(false);
    }
  }

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
  const totalLoyer = (property.loyer_base ?? 0) + (property.charges_mensuelles ?? 0);
  const isHabitation = ["appartement", "maison", "studio", "colocation"].includes(property.type);
  const isParking = ["parking", "box"].includes(property.type);
  const isCommercial = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(property.type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        {property.cover_url ? (
          <div className="relative h-[60vh] min-h-[400px] w-full">
            <Image
              src={property.cover_url}
              alt={property.adresse_complete}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent" />
          </div>
        ) : (
          <div className="relative h-[40vh] min-h-[300px] w-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
            <div className="text-center space-y-4">
              <TypeIcon className="h-24 w-24 mx-auto text-primary/30" />
              <div className="h-1 w-32 bg-primary/20 mx-auto rounded-full" />
            </div>
          </div>
        )}

        {/* Header Actions */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <Button
            variant="secondary"
            size="sm"
            className="backdrop-blur-md bg-background/80 border-border/50"
            onClick={() => router.push(`/properties/${property.id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="backdrop-blur-md bg-background/80 border-border/50"
            onClick={() => router.push("/properties")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>

        {/* Hero Content */}
        <div className="container mx-auto px-4 md:px-6 lg:px-8 -mt-32 relative z-10">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Title & Status */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <TypeIcon className="h-8 w-8 text-primary" />
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    {TYPE_LABELS[property.type] || property.type}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={statusConfig.variant} className="text-sm px-3 py-1">
                    <StatusIcon className="h-3 w-3 mr-1.5" />
                    {statusConfig.label}
                  </Badge>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="text-base">{property.adresse_complete}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Key Metrics */}
            <motion.div variants={itemVariants}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {isHabitation && property.surface && (
                  <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="h-4 w-4 text-primary" />
                        <p className="text-xs text-muted-foreground">Surface</p>
                      </div>
                      <p className="text-2xl font-bold">{property.surface} m²</p>
                    </CardContent>
                  </Card>
                )}
                {isHabitation && property.nb_pieces && (
                  <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Home className="h-4 w-4 text-primary" />
                        <p className="text-xs text-muted-foreground">Pièces</p>
                      </div>
                      <p className="text-2xl font-bold">{property.nb_pieces}</p>
                    </CardContent>
                  </Card>
                )}
                <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Euro className="h-4 w-4 text-primary" />
                      <p className="text-xs text-muted-foreground">Loyer CC</p>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(totalLoyer)}</p>
                  </CardContent>
                </Card>
                <Card className={`${CLASSES_EXTENDED.card} border-primary/20`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Key className="h-4 w-4 text-primary" />
                      <p className="text-xs text-muted-foreground">Code</p>
                    </div>
                    <p className="text-sm font-mono font-bold">{property.unique_code}</p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="data-[state=active]:bg-background">
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="details" className="data-[state=active]:bg-background">
              Détails
            </TabsTrigger>
            <TabsTrigger value="leases" className="data-[state=active]:bg-background">
              Baux
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="data-[state=active]:bg-background">
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-background">
              Documents
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="overview" className="space-y-6 mt-6">
              <motion.div
                key="overview"
                variants={stepTransitionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid gap-6 md:grid-cols-2"
              >
                {/* Informations générales */}
                <Card className={CLASSES_EXTENDED.card}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Info className="h-5 w-5 text-primary" />
                      Informations générales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-muted-foreground">Adresse complète</p>
                      <p className="text-base">{property.adresse_complete}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.code_postal} {property.ville} ({property.departement})
                      </p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Type</p>
                        <p className="text-base font-medium">{TYPE_LABELS[property.type]}</p>
                      </div>
                      {property.usage_principal && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Usage</p>
                          <p className="text-base font-medium capitalize">{property.usage_principal.replace(/_/g, " ")}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Conditions financières */}
                <Card className={CLASSES_EXTENDED.card}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Euro className="h-5 w-5 text-primary" />
                      Conditions financières
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Loyer HC</p>
                        <p className="text-xl font-bold">{formatCurrency(property.loyer_base ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Charges</p>
                        <p className="text-xl font-bold">{formatCurrency(property.charges_mensuelles ?? 0)}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Total charges comprises</p>
                      <p className="text-3xl font-bold text-primary">{formatCurrency(totalLoyer)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Dépôt de garantie</p>
                      <p className="text-xl font-bold">{formatCurrency(property.depot_garantie ?? 0)}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Caractéristiques (si habitation) */}
                {isHabitation && (
                  <Card className={CLASSES_EXTENDED.card}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5 text-primary" />
                        Caractéristiques
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {property.surface && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Surface</p>
                            <p className="text-xl font-bold">{property.surface} m²</p>
                          </div>
                        )}
                        {property.nb_pieces && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Pièces</p>
                            <p className="text-xl font-bold">{property.nb_pieces}</p>
                          </div>
                        )}
                        {property.nb_chambres !== null && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Chambres</p>
                            <p className="text-xl font-bold">{property.nb_chambres}</p>
                          </div>
                        )}
                        {property.etage !== null && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Étage</p>
                            <p className="text-xl font-bold">{property.etage}</p>
                          </div>
                        )}
                      </div>
                      {property.ascenseur !== null && (
                        <>
                          <Separator />
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${property.ascenseur ? "bg-green-500" : "bg-gray-400"}`} />
                            <span className="text-sm">{property.ascenseur ? "Avec ascenseur" : "Sans ascenseur"}</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Diagnostics énergétiques */}
                {isHabitation && (property.dpe_classe_energie || property.dpe_classe_climat) && (
                  <Card className={CLASSES_EXTENDED.card}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Diagnostics énergétiques
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {property.dpe_classe_energie && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Classe énergie</p>
                            <p className="text-2xl font-bold">{property.dpe_classe_energie}</p>
                          </div>
                        )}
                        {property.dpe_classe_climat && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Classe climat</p>
                            <p className="text-2xl font-bold">{property.dpe_classe_climat}</p>
                          </div>
                        )}
                      </div>
                      {property.dpe_consommation && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Consommation</p>
                          <p className="text-base">{property.dpe_consommation} kWh/m².an</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="details" className="space-y-6 mt-6">
              <motion.div
                key="details"
                variants={stepTransitionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                {/* Section Habitation */}
                {isHabitation && (
                  <>
                    {/* Confort & Équipements */}
                    <Card className={CLASSES_EXTENDED.card}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          Confort & Équipements
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {property.chauffage_type && (
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground">Chauffage</p>
                              <div className="flex items-center gap-2 mt-1">
                                {property.chauffage_type === "individuel" && <Zap className="h-4 w-4 text-primary" />}
                                {property.chauffage_type === "collectif" && <Building2 className="h-4 w-4 text-primary" />}
                                {property.chauffage_type === "aucun" && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                                <p className="text-base font-medium capitalize">{property.chauffage_type}</p>
                              </div>
                              {property.chauffage_energie && property.chauffage_type !== "aucun" && (
                                <p className="text-sm text-muted-foreground mt-1 capitalize">
                                  {property.chauffage_energie.replace(/_/g, " ")}
                                </p>
                              )}
                            </div>
                          )}
                          {property.eau_chaude_type && (
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground">Eau chaude</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Droplet className="h-4 w-4 text-primary" />
                                <p className="text-base font-medium capitalize">
                                  {property.eau_chaude_type.replace(/_/g, " ")}
                                </p>
                              </div>
                            </div>
                          )}
                          {property.clim_presence && (
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground">Climatisation</p>
                              <div className="flex items-center gap-2 mt-1">
                                {property.clim_presence === "fixe" && <Snowflake className="h-4 w-4 text-primary" />}
                                {property.clim_presence === "mobile" && <Wind className="h-4 w-4 text-primary" />}
                                {property.clim_presence === "aucune" && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                                <p className="text-base font-medium capitalize">{property.clim_presence}</p>
                              </div>
                              {property.clim_type && property.clim_presence === "fixe" && (
                                <p className="text-sm text-muted-foreground mt-1 capitalize">
                                  {property.clim_type}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        {(property as any).equipments && Array.isArray((property as any).equipments) && (property as any).equipments.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground mb-2">Équipements disponibles</p>
                              <div className="flex flex-wrap gap-2">
                                {(property as any).equipments.map((eq: string) => (
                                  <Badge key={eq} variant="outline" className="capitalize">
                                    {eq.replace(/_/g, " ")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Extérieurs */}
                    {((property as any).has_balcon || (property as any).has_terrasse || (property as any).has_jardin || (property as any).has_cave) && (
                      <Card className={CLASSES_EXTENDED.card}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Sun className="h-5 w-5 text-primary" />
                            Extérieurs & Annexes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(property as any).has_balcon && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Balcon</span>
                              </div>
                            )}
                            {(property as any).has_terrasse && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Terrasse</span>
                              </div>
                            )}
                            {(property as any).has_jardin && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Jardin</span>
                              </div>
                            )}
                            {(property as any).has_cave && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Cave</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Section Parking */}
                {isParking && (
                  <Card className={CLASSES_EXTENDED.card}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-primary" />
                        Détails du parking
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(property as any).parking_type && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Type</p>
                            <p className="text-base font-medium capitalize">
                              {(property as any).parking_type.replace(/_/g, " ")}
                            </p>
                          </div>
                        )}
                        {(property as any).parking_gabarit && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Gabarit recommandé</p>
                            <p className="text-base font-medium capitalize">
                              {(property as any).parking_gabarit.replace(/_/g, " ")}
                            </p>
                          </div>
                        )}
                        {(property as any).parking_numero && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Numéro / Repère</p>
                            <p className="text-base font-medium">{(property as any).parking_numero}</p>
                          </div>
                        )}
                        {(property as any).parking_niveau && (
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground">Niveau</p>
                            <p className="text-base font-medium">{(property as any).parking_niveau}</p>
                          </div>
                        )}
                      </div>
                      {(property as any).parking_acces && Array.isArray((property as any).parking_acces) && (property as any).parking_acces.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground mb-2">Moyens d'accès</p>
                            <div className="flex flex-wrap gap-2">
                              {(property as any).parking_acces.map((acc: string) => (
                                <Badge key={acc} variant="outline" className="capitalize">
                                  {acc.replace(/_/g, " ")}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {(property as any).parking_portail_securise !== null && (
                          <div className="flex items-center gap-2">
                            {(property as any).parking_portail_securise ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">Portail sécurisé</span>
                          </div>
                        )}
                        {(property as any).parking_video_surveillance !== null && (
                          <div className="flex items-center gap-2">
                            {(property as any).parking_video_surveillance ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">Vidéosurveillance</span>
                          </div>
                        )}
                        {(property as any).parking_gardien !== null && (
                          <div className="flex items-center gap-2">
                            {(property as any).parking_gardien ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm">Gardien / Concierge</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Section Commercial */}
                {isCommercial && (
                  <>
                    <Card className={CLASSES_EXTENDED.card}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building className="h-5 w-5 text-primary" />
                          Caractéristiques du local
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(property as any).local_surface_totale && (
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground">Surface totale</p>
                              <p className="text-xl font-bold">{(property as any).local_surface_totale} m²</p>
                            </div>
                          )}
                          {(property as any).local_type && (
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground">Type de local</p>
                              <p className="text-base font-medium capitalize">
                                {(property as any).local_type.replace(/_/g, " ")}
                              </p>
                            </div>
                          )}
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {(property as any).local_has_vitrine !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_has_vitrine ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Vitrine sur rue</span>
                            </div>
                          )}
                          {(property as any).local_access_pmr !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_access_pmr ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Accessible PMR</span>
                            </div>
                          )}
                          {(property as any).local_clim !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_clim ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Climatisation</span>
                            </div>
                          )}
                          {(property as any).local_fibre !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_fibre ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Fibre / Internet pro</span>
                            </div>
                          )}
                          {(property as any).local_alarme !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_alarme ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Alarme</span>
                            </div>
                          )}
                          {(property as any).local_rideau_metal !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_rideau_metal ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Rideau métallique</span>
                            </div>
                          )}
                          {(property as any).local_acces_camion !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_acces_camion ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Accès camion</span>
                            </div>
                          )}
                          {(property as any).local_parking_clients !== null && (
                            <div className="flex items-center gap-2">
                              {(property as any).local_parking_clients ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-sm">Parking clients</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Paramètres professionnels */}
                    {(property.erp_type || property.erp_categorie || property.erp_accessibilite !== null) && (
                      <Card className={CLASSES_EXTENDED.card}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            Sécurité & Accessibilité ERP
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {property.erp_type && (
                              <div>
                                <p className="text-sm font-semibold text-muted-foreground">Type ERP</p>
                                <p className="text-base font-medium">{property.erp_type}</p>
                              </div>
                            )}
                            {property.erp_categorie && (
                              <div>
                                <p className="text-sm font-semibold text-muted-foreground">Catégorie ERP</p>
                                <p className="text-base font-medium">{property.erp_categorie}</p>
                              </div>
                            )}
                          </div>
                          {property.erp_accessibilite !== null && (
                            <>
                              <Separator />
                              <div className="flex items-center gap-2">
                                {property.erp_accessibilite ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                )}
                                <span className="text-base font-medium">
                                  {property.erp_accessibilite ? "Accessibilité ERP conforme" : "Accessibilité ERP à vérifier"}
                                </span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Conditions de location */}
                <Card className={CLASSES_EXTENDED.card}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5 text-primary" />
                      Conditions de location
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Loyer hors charges</p>
                        <p className="text-2xl font-bold">{formatCurrency(property.loyer_base ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Charges mensuelles</p>
                        <p className="text-2xl font-bold">{formatCurrency(property.charges_mensuelles ?? 0)}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Total charges comprises</p>
                      <p className="text-4xl font-bold text-primary">{formatCurrency(totalLoyer)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Dépôt de garantie</p>
                      <p className="text-2xl font-bold">{formatCurrency(property.depot_garantie ?? 0)}</p>
                    </div>
                    {(property as any).type_bail && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Type de bail</p>
                          <p className="text-base font-medium capitalize">
                            {(property as any).type_bail.replace(/_/g, " ")}
                          </p>
                        </div>
                      </>
                    )}
                    {(property as any).preavis_mois && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Préavis</p>
                        <p className="text-base font-medium">{(property as any).preavis_mois} mois</p>
                      </div>
                    )}
                    {property.zone_encadrement && (
                      <>
                        <Separator />
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <p className="text-sm font-semibold">Zone d'encadrement des loyers</p>
                          </div>
                          {property.loyer_reference_majoré && (
                            <p className="text-sm text-muted-foreground">
                              Référence majorée : {formatCurrency(property.loyer_reference_majoré)}
                            </p>
                          )}
                          {property.complement_loyer !== null && property.complement_loyer > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Complément : {formatCurrency(property.complement_loyer)}
                              {property.complement_justification && (
                                <span className="block italic mt-1">« {property.complement_justification} »</span>
                              )}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Permis de louer */}
                {property.permis_louer_requis && (
                  <Card className={CLASSES_EXTENDED.card}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-primary" />
                        Permis de louer
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-base font-medium">Permis requis</span>
                      </div>
                      {property.permis_louer_numero && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Numéro d'autorisation</p>
                          <p className="text-base font-medium">{property.permis_louer_numero}</p>
                        </div>
                      )}
                      {property.permis_louer_date && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Date d'obtention</p>
                          <p className="text-base font-medium">{formatDateShort(property.permis_louer_date)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Dates & Métadonnées */}
                <Card className={CLASSES_EXTENDED.card}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Historique
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Créé le</p>
                        <p className="text-base font-medium">{formatDateShort(property.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Modifié le</p>
                        <p className="text-base font-medium">{formatDateShort(property.updated_at)}</p>
                      </div>
                      {property.submitted_at && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Soumis le</p>
                          <p className="text-base font-medium">{formatDateShort(property.submitted_at)}</p>
                        </div>
                      )}
                      {property.validated_at && (
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">Validé le</p>
                          <p className="text-base font-medium">{formatDateShort(property.validated_at)}</p>
                        </div>
                      )}
                    </div>
                    {property.etat === "rejected" && property.rejection_reason && (
                      <>
                        <Separator />
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            <p className="text-sm font-semibold text-destructive">Motif de rejet</p>
                          </div>
                          <p className="text-sm text-destructive">{property.rejection_reason}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="leases" className="space-y-6 mt-6">
              <motion.div
                key="leases"
                variants={stepTransitionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Baux associés</h2>
                  <Link href={`/owner/leases/new?propertyId=${property.id}`}>
                    <Button>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Créer un bail
                    </Button>
                  </Link>
                </div>
                <LeasesList propertyId={property.id} />
              </motion.div>
            </TabsContent>

            <TabsContent value="maintenance" className="space-y-6 mt-6">
              <motion.div
                key="maintenance"
                variants={stepTransitionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Tickets de maintenance</h2>
                </div>
                <TicketsList propertyId={property.id} />
              </motion.div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-6 mt-6">
              <motion.div
                key="documents"
                variants={stepTransitionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Documents</h2>
                </div>
                <DocumentGalleryManager
                  propertyId={property.id}
                  collection="property_media"
                  type="autre"
                  onChange={(docs) => {
                    // Handle documents change
                  }}
                />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}


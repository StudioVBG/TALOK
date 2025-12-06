"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Home,
  Mail,
  Phone,
  User,
  Building2,
  FileText,
  TrendingUp,
  Activity,
  Shield,
  Sparkles,
  ExternalLink,
  Download,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/helpers/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Nouveaux composants SOTA 2025
import {
  OwnerFinancialDashboard,
  defaultFinancialMetrics,
  type OwnerFinancialMetrics,
} from "@/components/admin/owner-financial-dashboard";
import {
  AICopilotPanel,
  generateOwnerInsights,
  type AIInsight,
} from "@/components/admin/ai-copilot-panel";
import {
  OwnerModerationPanel,
  type AccountStatus,
  type AccountFlag,
  type ModerationAction,
  type AdminNote,
  type ModerationActionType,
} from "@/components/admin/owner-moderation-panel";
import {
  OwnerActivityFeed,
  type ActivityEvent,
} from "@/components/admin/owner-activity-feed";
import { OwnerSubscriptionCard } from "@/components/admin/owner-subscription-card";

import type { AdminOwnerDetails } from "../../../_data/fetchAdminOwnerDetails";

interface OwnerDetailsClientProps {
  owner: AdminOwnerDetails;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function OwnerDetailsClient({ owner }: OwnerDetailsClientProps) {
  const { toast } = useToast();
  const ownerName = `${owner.prenom || ""} ${owner.nom || ""}`.trim() || "Sans nom";

  // États pour les données enrichies
  const [activeTab, setActiveTab] = React.useState("overview");
  const [financials, setFinancials] = React.useState<OwnerFinancialMetrics>(defaultFinancialMetrics);
  const [financialsLoading, setFinancialsLoading] = React.useState(true);
  const [activities, setActivities] = React.useState<ActivityEvent[]>([]);
  const [activitiesLoading, setActivitiesLoading] = React.useState(true);
  const [moderation, setModeration] = React.useState<{
    accountStatus: AccountStatus;
    flags: AccountFlag[];
    history: ModerationAction[];
    notes: AdminNote[];
    lastLogin?: string;
  }>({
    accountStatus: "active",
    flags: [],
    history: [],
    notes: [],
  });
  const [moderationLoading, setModerationLoading] = React.useState(true);

  // Insights IA générés à partir des données
  const [aiInsights, setAiInsights] = React.useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = React.useState(true);

  // Charger les données financières
  const fetchFinancials = React.useCallback(async () => {
    try {
      setFinancialsLoading(true);
      const response = await fetch(`/api/admin/people/owners/${owner.id}/financials`);
      if (response.ok) {
        const data = await response.json();
        setFinancials(data);
      }
    } catch (error) {
      console.error("Error fetching financials:", error);
    } finally {
      setFinancialsLoading(false);
    }
  }, [owner.id]);

  // Charger l'activité
  const fetchActivity = React.useCallback(async () => {
    try {
      setActivitiesLoading(true);
      const response = await fetch(`/api/admin/people/owners/${owner.id}/activity`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setActivitiesLoading(false);
    }
  }, [owner.id]);

  // Charger la modération
  const fetchModeration = React.useCallback(async () => {
    try {
      setModerationLoading(true);
      const response = await fetch(`/api/admin/people/owners/${owner.id}/moderation`);
      if (response.ok) {
        const data = await response.json();
        setModeration(data);
      }
    } catch (error) {
      console.error("Error fetching moderation:", error);
    } finally {
      setModerationLoading(false);
    }
  }, [owner.id]);

  // Générer les insights IA
  React.useEffect(() => {
    if (!financialsLoading && financials) {
      setAiLoading(true);
      // Simuler un délai pour l'effet "IA en train d'analyser"
      const timer = setTimeout(() => {
        const insights = generateOwnerInsights({
          occupancyRate: owner.stats.totalProperties > 0
            ? Math.round((owner.stats.activeLeases / owner.stats.totalProperties) * 100)
            : 0,
          unpaidAmount: financials.unpaidAmount,
          unpaidInvoices: financials.unpaidInvoices,
          monthlyRevenue: financials.monthlyRevenue,
          averagePaymentDelay: financials.averagePaymentDelay,
          propertiesCount: owner.stats.totalProperties,
          vacantProperties: owner.stats.totalProperties - owner.stats.activeLeases,
          activeLeases: owner.stats.activeLeases,
          ticketsOpen: 0, // TODO: récupérer depuis l'API
        });
        setAiInsights(insights);
        setAiLoading(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [financialsLoading, financials, owner.stats]);

  // Charger les données au montage
  React.useEffect(() => {
    fetchFinancials();
    fetchActivity();
    fetchModeration();
  }, [fetchFinancials, fetchActivity, fetchModeration]);

  // Actions de modération
  const handleModerationAction = async (action: ModerationActionType, reason: string) => {
    const response = await fetch(`/api/admin/people/owners/${owner.id}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de l'action");
    }

    // Rafraîchir les données
    fetchModeration();
  };

  const handleAddNote = async (note: string) => {
    // TODO: Implémenter l'ajout de note
    toast({
      title: "Note ajoutée",
      description: "La fonctionnalité sera bientôt disponible.",
    });
  };

  const handleExportData = async () => {
    toast({
      title: "Export en cours",
      description: "Les données seront téléchargées sous peu.",
    });
    // TODO: Implémenter l'export RGPD
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/people?tab=owners">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarImage src={owner.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {owner.prenom?.[0]}{owner.nom?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{ownerName}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    moderation.accountStatus === "active" && "border-emerald-500 text-emerald-600",
                    moderation.accountStatus === "suspended" && "border-amber-500 text-amber-600",
                    moderation.accountStatus === "banned" && "border-red-500 text-red-600"
                  )}
                >
                  {owner.role}
                </Badge>
                <span>•</span>
                <span>Inscrit le {formatDateShort(owner.created_at)}</span>
                {moderation.lastLogin && (
                  <>
                    <span>•</span>
                    <span className="text-xs">
                      Dernière connexion: {formatDateShort(moderation.lastLogin)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions rapides</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Mail className="mr-2 h-4 w-4" />
                Envoyer un email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportData}>
                <Download className="mr-2 h-4 w-4" />
                Exporter données (RGPD)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/owner?impersonate=${owner.id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Voir comme propriétaire
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* Navigation par onglets */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Vue d'ensemble</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Finances</span>
            </TabsTrigger>
            <TabsTrigger value="properties" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Biens</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activité</span>
            </TabsTrigger>
            <TabsTrigger value="moderation" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Modération</span>
            </TabsTrigger>
          </TabsList>

          {/* Onglet Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Colonne gauche: Infos + AI Copilot */}
              <div className="space-y-6">
                {/* Coordonnées */}
                <Card className="border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Coordonnées</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{owner.email || "Non renseigné"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{owner.telephone || "Non renseigné"}</span>
                    </div>
                    {owner.owner_profiles && (
                      <div className="pt-4 border-t mt-4">
                        <p className="text-sm font-medium mb-2">Infos Professionnelles</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type</span>
                            <span className="capitalize">{owner.owner_profiles.type}</span>
                          </div>
                          {owner.owner_profiles.siret && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SIRET</span>
                              <span className="font-mono text-xs">{owner.owner_profiles.siret}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Statistiques rapides */}
                <Card className="border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Statistiques</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Biens</span>
                      <span className="font-bold text-lg">{owner.stats.totalProperties}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Baux actifs</span>
                      <span className="font-bold text-lg text-emerald-600">
                        {owner.stats.activeLeases}
                      </span>
                    </div>
                    {!financialsLoading && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Revenus mensuels</span>
                          <span className="font-bold text-lg text-primary">
                            {financials.monthlyRevenue.toLocaleString("fr-FR")}€
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Taux recouvrement</span>
                          <span className={cn(
                            "font-bold text-lg",
                            financials.collectionRate >= 90 ? "text-emerald-600" :
                            financials.collectionRate >= 70 ? "text-amber-600" : "text-red-600"
                          )}>
                            {financials.collectionRate}%
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Forfait / Abonnement */}
                <OwnerSubscriptionCard
                  ownerId={owner.id}
                  ownerUserId={owner.user_id}
                  ownerEmail={owner.email}
                  subscription={owner.subscription}
                  onUpdate={() => window.location.reload()}
                />

                {/* AI Copilot */}
                <AICopilotPanel
                  insights={aiInsights}
                  isLoading={aiLoading}
                  onRefresh={() => {
                    setAiLoading(true);
                    setTimeout(() => setAiLoading(false), 1000);
                  }}
                />
              </div>

              {/* Colonne droite: Biens récents + Activité */}
              <div className="lg:col-span-2 space-y-6">
                {/* Aperçu financier compact */}
                {!financialsLoading ? (
                  <Card className="border-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Revenus totaux</p>
                          <p className="text-2xl font-bold text-primary">
                            {financials.totalRevenue.toLocaleString("fr-FR")}€
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Impayés</p>
                          <p className={cn(
                            "text-2xl font-bold",
                            financials.unpaidAmount > 0 ? "text-red-600" : "text-emerald-600"
                          )}>
                            {financials.unpaidAmount.toLocaleString("fr-FR")}€
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Délai moyen</p>
                          <p className="text-2xl font-bold">
                            {financials.averagePaymentDelay}j
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Score risque</p>
                          <p className={cn(
                            "text-2xl font-bold",
                            financials.riskScore <= 30 ? "text-emerald-600" :
                            financials.riskScore <= 60 ? "text-amber-600" : "text-red-600"
                          )}>
                            {financials.riskScore <= 30 ? "Faible" :
                             financials.riskScore <= 60 ? "Modéré" : "Élevé"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-0 bg-card/50">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="text-center space-y-2">
                            <Skeleton className="h-4 w-20 mx-auto" />
                            <Skeleton className="h-8 w-24 mx-auto" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Biens récents */}
                <Card className="border-0 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Parc Immobilier ({owner.properties.length})
                      </CardTitle>
                      <CardDescription>
                        Biens gérés par ce propriétaire
                      </CardDescription>
                    </div>
                    {owner.properties.length > 0 && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/properties?owner=${owner.id}`}>
                          Voir tout
                        </Link>
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {owner.properties.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Home className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Aucun bien enregistré.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {owner.properties.slice(0, 4).map((property) => (
                          <Link key={property.id} href={`/admin/properties/${property.id}`}>
                            <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer group">
                              <div className="flex justify-between items-start mb-2">
                                <Badge variant="secondary" className="capitalize text-xs">
                                  {property.type}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    property.rental_status === "occupied" && "border-emerald-500 text-emerald-600",
                                    property.rental_status === "vacant" && "border-amber-500 text-amber-600"
                                  )}
                                >
                                  {property.rental_status || "vacant"}
                                </Badge>
                              </div>
                              <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                                {property.adresse_complete}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {property.code_postal} {property.ville}
                              </p>
                              <div className="mt-2 text-xs flex gap-2 text-muted-foreground">
                                {property.surface && <span>{property.surface} m²</span>}
                                {property.nb_pieces && <span>• {property.nb_pieces} p.</span>}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Activité récente */}
                <OwnerActivityFeed
                  activities={activities.slice(0, 10)}
                  isLoading={activitiesLoading}
                  onRefresh={fetchActivity}
                  maxHeight={300}
                />
              </div>
            </div>
          </TabsContent>

          {/* Onglet Finances */}
          <TabsContent value="finances">
            <OwnerFinancialDashboard
              metrics={financials}
            />
          </TabsContent>

          {/* Onglet Biens */}
          <TabsContent value="properties">
            <Card className="border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Parc Immobilier</CardTitle>
                <CardDescription>
                  {owner.properties.length} bien{owner.properties.length > 1 ? "s" : ""} enregistré{owner.properties.length > 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {owner.properties.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Home className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-1">Aucun bien enregistré</p>
                    <p className="text-sm">Ce propriétaire n'a pas encore ajouté de bien.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {owner.properties.map((property) => (
                      <Link key={property.id} href={`/admin/properties/${property.id}`}>
                        <Card className="hover:shadow-md transition-all cursor-pointer group border-0 bg-muted/30">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-3">
                              <Badge variant="secondary" className="capitalize">
                                {property.type}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  property.rental_status === "occupied" && "border-emerald-500 text-emerald-600 bg-emerald-50",
                                  property.rental_status === "vacant" && "border-amber-500 text-amber-600 bg-amber-50"
                                )}
                              >
                                {property.rental_status || "vacant"}
                              </Badge>
                            </div>
                            <h4 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                              {property.adresse_complete}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {property.code_postal} {property.ville}
                            </p>
                            <div className="mt-4 pt-3 border-t flex justify-between text-sm">
                              {property.surface && (
                                <span className="text-muted-foreground">{property.surface} m²</span>
                              )}
                              {property.nb_pieces && (
                                <span className="text-muted-foreground">{property.nb_pieces} pièces</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Activité */}
          <TabsContent value="activity">
            <OwnerActivityFeed
              activities={activities}
              isLoading={activitiesLoading}
              onRefresh={fetchActivity}
              maxHeight={600}
            />
          </TabsContent>

          {/* Onglet Modération */}
          <TabsContent value="moderation">
            <OwnerModerationPanel
              ownerId={owner.id}
              ownerName={ownerName}
              accountStatus={moderation.accountStatus}
              flags={moderation.flags}
              history={moderation.history}
              notes={moderation.notes}
              lastLogin={moderation.lastLogin}
              onAction={handleModerationAction}
              onAddNote={handleAddNote}
              onExportData={handleExportData}
            />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

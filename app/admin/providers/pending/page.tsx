"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { Search, CheckCircle2, XCircle, Clock, Eye, AlertCircle, Mail, Phone, MapPin, Calendar, Edit, UserPlus, Pause, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface PendingProvider {
  id: string;
  profile_id: string;
  name: string;
  email?: string;
  phone?: string;
  type_services: string[];
  certifications?: string;
  zones_intervention?: string;
  status: "pending" | "approved" | "rejected";
  validated_at?: string;
  validated_by?: string;
  rejection_reason?: string;
  created_at: string;
}

function PendingProvidersContent() {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<PendingProvider[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<PendingProvider | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const limit = 20;
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [providerDetails, setProviderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editForm, setEditForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    phone: "",
    type_services: [] as string[],
    zones_intervention: "",
    certifications: "",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    prenom: "",
    nom: "",
    phone: "",
    type_services: [] as string[],
    zones_intervention: "",
  });
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      toast({
        title: "Non authentifié",
        description: "Vous devez être connecté pour accéder à cette page.",
        variant: "destructive",
      });
      return;
    }

    if (profile?.role !== "admin") {
      toast({
        title: "Accès refusé",
        description: "Vous devez être administrateur pour accéder à cette page.",
        variant: "destructive",
      });
      return;
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search, page, user, profile, authLoading]);

  async function fetchData() {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const searchParams = new URLSearchParams({
        search,
        page: page.toString(),
        limit: limit.toString(),
        status: activeTab,
      });

      const response = await fetch(`/api/admin/providers/pending?${searchParams.toString()}`, {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la récupération des prestataires");
      }

      const data = await response.json();
      setProviders(data.items || []);
      setTotal(data.total || 0);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les prestataires",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(provider: PendingProvider) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/providers/${provider.profile_id}/approve`, {
        method: "POST",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'approbation");
      }

      toast({
        title: "Prestataire approuvé",
        description: `${provider.name} a été approuvé avec succès.`,
      });

      setApproveDialogOpen(false);
      setSelectedProvider(null);
      
      // Fermer le Sheet si ouvert
      if (detailSheetOpen && providerDetails?.id === provider.id) {
        setDetailSheetOpen(false);
        setProviderDetails(null);
      }
      
      // Rafraîchir les données
      await fetchData();
      
      // Si on est sur l'onglet "pending" et que le prestataire n'apparaît plus, 
      // basculer automatiquement sur "approved"
      if (activeTab === "pending") {
        // Le fetchData va mettre à jour la liste, si elle est vide on peut changer d'onglet
        setTimeout(() => {
          const currentProviders = providers.filter(p => p.id !== provider.id);
          if (currentProviders.length === 0 && providers.length > 0) {
            setActiveTab("approved");
          }
        }, 100);
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'approuver le prestataire",
        variant: "destructive",
      });
    }
  }

  async function handleReject(provider: PendingProvider) {
    if (!rejectionReason.trim()) {
      toast({
        title: "Raison requise",
        description: "Veuillez indiquer une raison pour le rejet.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/providers/${provider.profile_id}/reject`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du rejet");
      }

      toast({
        title: "Prestataire rejeté",
        description: `${provider.name} a été rejeté.`,
      });

      setRejectDialogOpen(false);
      setSelectedProvider(null);
      setRejectionReason("");
      
      // Fermer le Sheet si ouvert
      if (detailSheetOpen && providerDetails?.id === provider.id) {
        setDetailSheetOpen(false);
        setProviderDetails(null);
      }
      
      // Rafraîchir les données
      await fetchData();
      
      // Si on est sur l'onglet "pending" et que le prestataire n'apparaît plus, 
      // basculer automatiquement sur "rejected"
      if (activeTab === "pending") {
        setTimeout(() => {
          const currentProviders = providers.filter(p => p.id !== provider.id);
          if (currentProviders.length === 0 && providers.length > 0) {
            setActiveTab("rejected");
          }
        }, 100);
      }
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de rejeter le prestataire",
        variant: "destructive",
      });
    }
  }

  async function fetchProviderDetails(providerId: string) {
    setLoadingDetails(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/providers/${providerId}`, {
        credentials: "include",
        headers,
      });

      if (!response.ok) throw new Error("Erreur lors du chargement");

      const data = await response.json();
      setProviderDetails(data);
      setEditForm({
        prenom: data.prenom || "",
        nom: data.nom || "",
        email: data.email || "",
        phone: data.phone || "",
        type_services: data.type_services || [],
        zones_intervention: data.zones_intervention || "",
        certifications: data.certifications || "",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSaveEdit() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/providers/${providerDetails.id}`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la sauvegarde");
      }

      toast({
        title: "Succès",
        description: "Informations mises à jour avec succès",
      });

      setEditDialogOpen(false);
      
      // Rafraîchir les détails et la liste
      await Promise.all([
        fetchProviderDetails(providerDetails.id),
        fetchData()
      ]);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  }

  async function handleInvite() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/admin/providers/invite", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(inviteForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'invitation");
      }

      toast({
        title: "Succès",
        description: "Invitation envoyée avec succès",
      });

      setInviteDialogOpen(false);
      setInviteForm({
        email: "",
        prenom: "",
        nom: "",
        phone: "",
        type_services: [],
        zones_intervention: "",
      });
      fetchData();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  }

  async function handleSuspend() {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(`/api/admin/providers/${providerDetails.id}/suspend`, {
        method: providerDetails.suspended ? "DELETE" : "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ reason: suspendReason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'opération");
      }

      toast({
        title: "Succès",
        description: providerDetails.suspended ? "Prestataire réactivé" : "Prestataire mis en standby",
      });

      setSuspendDialogOpen(false);
      setSuspendReason("");
      
      // Rafraîchir les détails et la liste
      await Promise.all([
        fetchProviderDetails(providerDetails.id),
        fetchData()
      ]);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approuvé
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Rejeté
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            En attente
          </span>
        );
    }
  };

  const columns = [
    {
      header: "Nom",
      cell: (provider: PendingProvider) => (
        <div className="flex items-center gap-2 font-medium">
          {provider.name}
          {provider.email && (
            <Mail className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      )
    },
    {
      header: "Email",
      cell: (provider: PendingProvider) => provider.email || "-"
    },
    {
      header: "Téléphone",
      cell: (provider: PendingProvider) => provider.phone || "-"
    },
    {
      header: "Services",
      cell: (provider: PendingProvider) => (
        <div className="flex flex-wrap gap-1">
          {provider.type_services.slice(0, 2).map((service, idx) => (
            <span
              key={idx}
              className="px-2 py-1 bg-muted rounded text-xs"
            >
              {service}
            </span>
          ))}
          {provider.type_services.length > 2 && (
            <span className="px-2 py-1 bg-muted rounded text-xs">
              +{provider.type_services.length - 2}
            </span>
          )}
        </div>
      )
    },
    {
      header: "Zones",
      cell: (provider: PendingProvider) => provider.zones_intervention || "-"
    },
    {
      header: "Statut",
      cell: (provider: PendingProvider) => getStatusBadge(provider.status)
    },
    {
      header: "Date de demande",
      cell: (provider: PendingProvider) => new Date(provider.created_at).toLocaleDateString("fr-FR")
    },
    {
      header: "Actions",
      cell: (provider: PendingProvider) => (
        <div className="flex items-center gap-2">
          {provider.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProvider(provider);
                  setApproveDialogOpen(true);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approuver
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProvider(provider);
                  setRejectDialogOpen(true);
                }}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Rejeter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailSheetOpen(true);
                  fetchProviderDetails(provider.id);
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                Voir
              </Button>
            </>
          )}
          {provider.status === "rejected" && provider.rejection_reason && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{provider.rejection_reason}</span>
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Validation des Prestataires</h1>
            <p className="text-muted-foreground mt-2">
              Gérez les demandes d'inscription des prestataires
            </p>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Inviter un prestataire
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Demandes de prestataires</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 w-64"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => {
              setActiveTab(v as any);
              setPage(1);
            }}>
              <TabsList>
                <TabsTrigger value="pending">
                  En attente
                </TabsTrigger>
                <TabsTrigger value="approved">Approuvés</TabsTrigger>
                <TabsTrigger value="rejected">Rejetés</TabsTrigger>
                <TabsTrigger value="all">Tous</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Chargement...</p>
                  </div>
                ) : providers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun prestataire trouvé
                  </div>
                ) : (
                  <>
                    <ResponsiveTable
                      data={providers}
                      columns={columns}
                      keyExtractor={(provider) => provider.id}
                      emptyMessage="Aucun prestataire trouvé"
                      onRowClick={async (provider) => {
                        setDetailSheetOpen(true);
                        await fetchProviderDetails(provider.id);
                      }}
                    />

                    {total > limit && (
                      <div className="flex justify-between items-center mt-4">
                        <p className="text-sm text-muted-foreground">
                          Affichage de {(page - 1) * limit + 1} à {Math.min(page * limit, total)} sur {total}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                          >
                            Précédent
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page * limit >= total}
                          >
                            Suivant
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Dialog d'approbation */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approuver le prestataire</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir approuver {selectedProvider?.name} ? Il pourra alors proposer ses services aux propriétaires.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => selectedProvider && handleApprove(selectedProvider)}
              >
                Approuver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de rejet */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeter le prestataire</DialogTitle>
              <DialogDescription>
                Veuillez indiquer la raison du rejet pour {selectedProvider?.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">Raison du rejet *</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ex: Documents incomplets, informations manquantes..."
                  className="mt-2"
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setRejectDialogOpen(false);
                setRejectionReason("");
              }}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedProvider && handleReject(selectedProvider)}
                disabled={!rejectionReason.trim()}
              >
                Rejeter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sheet pour les détails */}
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-full sm:w-[600px] lg:w-[700px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Fiche Prestataire</SheetTitle>
              <SheetDescription>
                Informations complètes du prestataire
              </SheetDescription>
            </SheetHeader>
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : providerDetails ? (
              <div className="mt-6 space-y-6">
                {/* En-tête avec statut */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{providerDetails.name}</h3>
                    <p className="text-muted-foreground mt-1">{providerDetails.email}</p>
                  </div>
                  {getStatusBadge(providerDetails.status)}
                </div>

                {/* Informations de contact */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {providerDetails.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{providerDetails.email}</p>
                        </div>
                      </div>
                    )}
                    {providerDetails.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Téléphone</p>
                          <p className="text-sm text-muted-foreground">{providerDetails.phone}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Services */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Services</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {providerDetails.type_services?.map((service: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Zones d'intervention */}
                {providerDetails.zones_intervention && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Zones d'intervention</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-muted-foreground" />
                        <p className="text-sm">{providerDetails.zones_intervention}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Certifications */}
                {providerDetails.certifications && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Certifications</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{providerDetails.certifications}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Dates */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Date d'inscription</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(providerDetails.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    {providerDetails.validated_at && (
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Date de validation</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(providerDetails.validated_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Raison de rejet */}
                {providerDetails.rejection_reason && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                      <CardTitle className="text-lg text-red-900">Raison du rejet</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-red-800">{providerDetails.rejection_reason}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Statut suspendu */}
                {providerDetails.suspended && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                      <CardTitle className="text-lg text-orange-900">Statut: En standby</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-orange-800">
                        {providerDetails.suspension_reason || "Mise en standby par l'administrateur"}
                      </p>
                      {providerDetails.suspended_at && (
                        <p className="text-xs text-orange-600 mt-2">
                          Depuis le {new Date(providerDetails.suspended_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          setEditDialogOpen(true);
                        }}
                      >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                  {providerDetails.status === "pending" && (
                    <>
                      <Button
                        variant="default"
                        onClick={() => {
                          setSelectedProvider(providerDetails);
                          setApproveDialogOpen(true);
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approuver
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setSelectedProvider(providerDetails);
                          setRejectDialogOpen(true);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeter
                      </Button>
                    </>
                  )}
                      <Button
                        variant={providerDetails.suspended ? "default" : "outline"}
                        onClick={async () => {
                          setSuspendDialogOpen(true);
                        }}
                      >
                    {providerDetails.suspended ? (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Réactiver
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Mettre en Standby
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </SheetContent>
        </Sheet>

        {/* Dialog d'édition */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le prestataire</DialogTitle>
              <DialogDescription>
                Modifiez les informations du prestataire sélectionné.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-prenom">Prénom</Label>
                  <Input
                    id="edit-prenom"
                    value={editForm.prenom}
                    onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })}
                    placeholder="Ex: Jean"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-nom">Nom</Label>
                  <Input
                    id="edit-nom"
                    value={editForm.nom}
                    onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                    placeholder="Ex: Dupont"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="Ex: jean.dupont@example.com"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Téléphone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="Ex: 0123456789"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-type-services">Type de Services (séparés par des virgules)</Label>
                <Input
                  id="edit-type-services"
                  value={editForm.type_services.join(", ")}
                  onChange={(e) => setEditForm({ ...editForm, type_services: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="Ex: Plomberie, Electricité, Jardinage"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-zones-intervention">Zones d'Intervention</Label>
                <Input
                  id="edit-zones-intervention"
                  value={editForm.zones_intervention}
                  onChange={(e) => setEditForm({ ...editForm, zones_intervention: e.target.value })}
                  placeholder="Ex: Paris, Lyon, Marseille"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-certifications">Certifications</Label>
                <Textarea
                  id="edit-certifications"
                  value={editForm.certifications}
                  onChange={(e) => setEditForm({ ...editForm, certifications: e.target.value })}
                  placeholder="Ex: CAP, BTS, Certificat professionnel..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit}>
                Enregistrer les modifications
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog d'invitation */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Inviter un nouveau prestataire</DialogTitle>
              <DialogDescription>
                Remplissez les informations pour inviter un nouveau prestataire. Un email d'invitation sera envoyé.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="invite-email">Email *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="Ex: nouvel.prestataire@example.com"
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invite-prenom">Prénom</Label>
                  <Input
                    id="invite-prenom"
                    value={inviteForm.prenom}
                    onChange={(e) => setInviteForm({ ...inviteForm, prenom: e.target.value })}
                    placeholder="Ex: Pierre"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="invite-nom">Nom</Label>
                  <Input
                    id="invite-nom"
                    value={inviteForm.nom}
                    onChange={(e) => setInviteForm({ ...inviteForm, nom: e.target.value })}
                    placeholder="Ex: Martin"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="invite-phone">Téléphone</Label>
                <Input
                  id="invite-phone"
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  placeholder="Ex: 0123456789"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="invite-type-services">Type de Services (séparés par des virgules)</Label>
                <Input
                  id="invite-type-services"
                  value={inviteForm.type_services.join(", ")}
                  onChange={(e) => setInviteForm({ ...inviteForm, type_services: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="Ex: Peinture, Menuiserie, Plomberie"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="invite-zones-intervention">Zones d'Intervention</Label>
                <Input
                  id="invite-zones-intervention"
                  value={inviteForm.zones_intervention}
                  onChange={(e) => setInviteForm({ ...inviteForm, zones_intervention: e.target.value })}
                  placeholder="Ex: Marseille, Nice, Toulon"
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleInvite} disabled={!inviteForm.email}>
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de suspension */}
        <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {providerDetails?.suspended ? "Réactiver le prestataire" : "Mettre en Standby le prestataire"}
              </DialogTitle>
              <DialogDescription>
                {providerDetails?.suspended
                  ? `Êtes-vous sûr de vouloir réactiver ${providerDetails?.name} ? Il pourra à nouveau proposer ses services.`
                  : `Êtes-vous sûr de vouloir mettre en standby ${providerDetails?.name} ? Il ne pourra plus proposer ses services.`}
              </DialogDescription>
            </DialogHeader>
            {!providerDetails?.suspended && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="suspend-reason">Raison (optionnelle)</Label>
                  <Textarea
                    id="suspend-reason"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Ex: Suspension temporaire pour vérification..."
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setSuspendDialogOpen(false);
                setSuspendReason("");
              }}>
                Annuler
              </Button>
              <Button
                variant={providerDetails?.suspended ? "default" : "destructive"}
                onClick={handleSuspend}
              >
                {providerDetails?.suspended ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Réactiver
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Mettre en Standby
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}

export default function PendingProvidersPage() {
  return <PendingProvidersContent />;
}


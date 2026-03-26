"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, FileText, Upload, Download, Trash2, Eye, Tag, FolderOpen, Loader2, LayoutGrid, List, Home, Bell, ShieldCheck } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { DOCUMENT_TYPES, DOCUMENT_STATUS_LABELS } from "@/lib/owner/constants";
import { ownerDocumentRoutes } from "@/lib/owner/routes";
import { useToast } from "@/components/ui/use-toast";

// React Query hooks pour la réactivité
import { useDocuments, useDeleteDocument } from "@/lib/hooks/use-documents";
import { useAuth } from "@/lib/hooks/use-auth";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PDFPreviewModal } from "@/components/documents/pdf-preview-modal";
import { DocumentGroups } from "@/components/documents/document-groups";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// GED Imports (consolidation Coffre-fort SOTA 2026)
import { QuickView } from "@/components/ged/quick-view";
import { TypeView } from "@/components/ged/type-view";
import { AlertsPanel } from "@/components/ged/alerts-panel";
import { GedUploadDialog } from "@/components/ged/ged-upload-dialog";
import { useGedDocuments, useGedDeleteDocument } from "@/lib/hooks/use-ged-documents";
import { useGedAlertsSummary } from "@/lib/hooks/use-ged-alerts";
import type { GedDocument, GedViewMode } from "@/lib/types/ged";

// Props
interface OwnerDocumentsClientProps {
  initialDocuments?: any[];
  properties?: Array<{ id: string; adresse_complete: string; ville: string }>;
}

export function OwnerDocumentsClient({ initialDocuments, properties }: OwnerDocumentsClientProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const propertyIdFilter = searchParams.get("property_id");
  const leaseIdFilter = searchParams.get("lease_id");

  // SOTA 2026 — Onglet de haut niveau : "bibliotheque" | "coffre-fort" | "alertes"
  const initialTab = searchParams.get("tab") || "bibliotheque";
  const [activeSection, setActiveSection] = useState<"bibliotheque" | "coffre-fort" | "alertes">(
    initialTab === "coffre-fort" ? "coffre-fort" : initialTab === "alertes" ? "alertes" : "bibliotheque"
  );

  // GED hooks (coffre-fort)
  const { data: gedDocuments = [], isLoading: isLoadingGed } = useGedDocuments({
    propertyId: propertyIdFilter,
    leaseId: leaseIdFilter,
  });
  const { data: alertsSummary, isLoading: isLoadingAlerts } = useGedAlertsSummary();
  const gedDeleteMutation = useGedDeleteDocument();
  const [gedViewMode, setGedViewMode] = useState<GedViewMode>("quick");
  const [gedUploadOpen, setGedUploadOpen] = useState(false);
  const [gedUploadDefaultType, setGedUploadDefaultType] = useState<string | undefined>();

  // GED handlers
  const handleGedUploadForType = useCallback((docType: string) => {
    setGedUploadDefaultType(docType);
    setGedUploadOpen(true);
  }, []);

  // ✅ React Query : données réactives avec mise à jour automatique
  // initialDocuments est utilisé comme fallback initial pour un rendu immédiat
  const { data: documents = initialDocuments || [], isLoading } = useDocuments({
    propertyId: propertyIdFilter,
    leaseId: leaseIdFilter,
  });
  const deleteDocumentMutation = useDeleteDocument();

  // Détecter les assurances expirées dans les documents de la bibliothèque
  const INSURANCE_TYPES = ["attestation_assurance", "assurance", "assurance_pno"];
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const now = new Date();

  const legacyInsuranceAlerts = (documents || []).filter((doc: any) => {
    if (!INSURANCE_TYPES.includes(doc.type)) return false;
    if (doc.expiry_date) return new Date(doc.expiry_date) < now;
    if (doc.created_at) return (now.getTime() - new Date(doc.created_at).getTime()) > ONE_YEAR_MS;
    return false;
  });

  // Alert badge count (GED + assurances legacy expirées)
  const alertCount = (alertsSummary
    ? alertsSummary.expired_count + alertsSummary.expiring_soon_count
    : 0) + legacyInsuranceAlerts.length;

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  
  // 🎨 Mode d'affichage : "table" (tableau) ou "cascade" (groupé par bien)
  const [viewMode, setViewMode] = useState<"table" | "cascade">("cascade");
  
  // Catégories disponibles pour le filtre
  const CATEGORIES = [
    { value: "all", label: "Toutes catégories" },
    { value: "contrat", label: "📄 Baux et Contrats" },
    { value: "diagnostic", label: "🔍 Diagnostics" },
    { value: "finance", label: "💰 Finances et Quittances" },
    { value: "edl", label: "📋 États des lieux" },
    { value: "assurance", label: "🛡️ Assurances" },
    { value: "identite", label: "👤 Dossier Locataire" },
    { value: "courrier", label: "✉️ Courriers" },
    { value: "autre", label: "📁 Autres" },
  ];
  
  // État pour le modal de prévisualisation
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // État pour la suppression
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any | null>(null);
  
  // 🔐 Générer une URL signée avant d'ouvrir la prévisualisation
  const openPreview = async (doc: any) => {
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewOpen(true);
    
    try {
      const response = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (response.ok) {
        const data = await response.json();
        setPreviewUrl(data.signedUrl);
      } else {
        console.error("Erreur génération URL signée");
        setPreviewUrl(null);
      }
    } catch (error) {
      console.error("Erreur fetch URL signée:", error);
      setPreviewUrl(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 🔐 Télécharger avec URL signée
  const handleDownload = async (doc: any) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (response.ok) {
        const data = await response.json();
        window.open(data.signedUrl, "_blank");
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de télécharger le document",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors du téléchargement",
        variant: "destructive",
      });
    }
  };
  
  const openDeleteDialog = (doc: any) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };
  
  // ✅ Suppression avec React Query - mise à jour automatique de l'UI !
  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    
    deleteDocumentMutation.mutate(documentToDelete.id, {
      onSuccess: () => {
        toast({
          title: "✅ Document supprimé",
          description: "Le document a été supprimé avec succès.",
        });
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
      },
      onError: (error: any) => {
        console.error("Erreur suppression:", error);
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de supprimer le document",
          variant: "destructive",
        });
      },
    });
  };

  // Catégories de documents avec couleurs - DOIT être défini avant son utilisation
  const getDocumentCategory = (type: string): { label: string; filterValue: string; color: string } => {
    const categories: Record<string, { label: string; filterValue: string; color: string }> = {
      // Contrats
      bail: { label: "Contrat", filterValue: "contrat", color: "bg-blue-100 text-blue-700 border-blue-200" },
      avenant: { label: "Contrat", filterValue: "contrat", color: "bg-blue-100 text-blue-700 border-blue-200" },
      engagement_garant: { label: "Contrat", filterValue: "contrat", color: "bg-blue-100 text-blue-700 border-blue-200" },
      // Diagnostics
      dpe: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      diagnostic: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      diagnostic_gaz: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      diagnostic_electricite: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      diagnostic_plomb: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      diagnostic_amiante: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      diagnostic_termites: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      erp: { label: "Diagnostic", filterValue: "diagnostic", color: "bg-orange-100 text-orange-700 border-orange-200" },
      // Finances
      quittance: { label: "Finance", filterValue: "finance", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      facture: { label: "Finance", filterValue: "finance", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      appel_loyer: { label: "Finance", filterValue: "finance", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      releve_charges: { label: "Finance", filterValue: "finance", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      avis_imposition: { label: "Finance", filterValue: "finance", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      bulletin_paie: { label: "Finance", filterValue: "finance", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
      // État des lieux
      edl_entree: { label: "EDL", filterValue: "edl", color: "bg-purple-100 text-purple-700 border-purple-200" },
      edl_sortie: { label: "EDL", filterValue: "edl", color: "bg-purple-100 text-purple-700 border-purple-200" },
      inventaire: { label: "EDL", filterValue: "edl", color: "bg-purple-100 text-purple-700 border-purple-200" },
      // Assurances
      attestation_assurance: { label: "Assurance", filterValue: "assurance", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
      assurance_pno: { label: "Assurance", filterValue: "assurance", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
      // Identité
      piece_identite: { label: "Identité", filterValue: "identite", color: "bg-muted text-foreground border-border" },
      cni_recto: { label: "Identité", filterValue: "identite", color: "bg-muted text-foreground border-border" },
      cni_verso: { label: "Identité", filterValue: "identite", color: "bg-muted text-foreground border-border" },
      passeport: { label: "Identité", filterValue: "identite", color: "bg-muted text-foreground border-border" },
      justificatif_domicile: { label: "Identité", filterValue: "identite", color: "bg-muted text-foreground border-border" },
      rib: { label: "Identité", filterValue: "identite", color: "bg-muted text-foreground border-border" },
      // Autres
      courrier: { label: "Courrier", filterValue: "courrier", color: "bg-pink-100 text-pink-700 border-pink-200" },
      photo: { label: "Photo", filterValue: "autre", color: "bg-amber-100 text-amber-700 border-amber-200" },
    };
    return categories[type] || { label: "Autre", filterValue: "autre", color: "bg-muted text-foreground border-border" };
  };

  // Filtrer les documents (filtrage côté client, le hook gère déjà propertyId)
  let filteredDocuments = documents;

  if (typeFilter !== "all") {
    filteredDocuments = filteredDocuments.filter((doc: any) => doc.type === typeFilter);
  }
  
  // Filtre par catégorie
  if (categoryFilter !== "all") {
    filteredDocuments = filteredDocuments.filter((doc: any) => {
      const category = getDocumentCategory(doc.type || "").filterValue;
      return category === categoryFilter;
    });
  }

  // Filtre par statut
  if (statusFilter && statusFilter !== "all") {
    filteredDocuments = filteredDocuments.filter((doc: any) => doc.statut === statusFilter || doc.status === statusFilter);
  }

  // Filtre par source (inter-compte)
  if (sourceFilter !== "all") {
    filteredDocuments = filteredDocuments.filter((doc: any) => {
      const isFromTenant = doc.tenant_id && doc.tenant_id !== profile?.id;
      return sourceFilter === "tenant" ? isFromTenant : !isFromTenant;
    });
  }

  if (searchQuery) {
    filteredDocuments = filteredDocuments.filter((doc: any) =>
      (doc.type?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (doc.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (doc.property?.adresse_complete?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
  }

  const getTypeLabel = (type: string) => {
    // @ts-ignore
    return DOCUMENT_TYPES[type] || type;
  };

  // Formater un nom de fichier technique en nom lisible
  const formatDocumentTitle = (doc: any): string => {
    // 1. Utiliser le titre lisible s'il existe et n'est pas un nom technique
    if (doc.display_name) return doc.display_name;
    if (doc.name && !doc.name.includes("_") && !doc.name.match(/^[A-Z_]+$/)) return doc.name;

    // 2. Utiliser le type label comme titre
    const typeLabel = getTypeLabel(doc.type || "");
    const tenantName = getTenantName(doc);

    // 3. Si le titre est un nom technique (ATTESTATION_ASSURANCE, etc.), le formater
    if (doc.title) {
      const isRawFilename = doc.title.match(/^[A-Z_]+$/) || doc.title.includes("_");
      if (!isRawFilename) return doc.title;
    }

    // 4. Construire un titre lisible à partir du type + locataire
    if (tenantName) return `${typeLabel} — ${tenantName}`;
    return typeLabel;
  };

  // Helper pour obtenir le nom du locataire
  const getTenantName = (doc: any) => {
    // 1. Données enrichies par la jointure
    if (doc.tenant?.prenom || doc.tenant?.nom) {
      return `${doc.tenant.prenom || ""} ${doc.tenant.nom || ""}`.trim();
    }
    // 2. Métadonnées du document (ex: CNI OCR)
    if (doc.metadata?.prenom || doc.metadata?.nom) {
      return `${doc.metadata.prenom || ""} ${doc.metadata.nom || ""}`.trim();
    }
    return null;
  };

  // Colonnes SOTA
  const columns = [
    {
        header: "Document",
        cell: (doc: any) => {
            const category = getDocumentCategory(doc.type || "");
            const typeLabel = getTypeLabel(doc.type || "");
            const tenantName = getTenantName(doc);
            
            // Titre enrichi avec le nom du locataire pour les documents d'identité
            let title = doc.title || (doc.metadata?.filename) || typeLabel;
            if (tenantName && category.filterValue === "identite") {
              title = `${typeLabel} - ${tenantName}`;
            }
            
            return (
              <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm border border-indigo-100">
                      <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                      <span className="font-semibold text-foreground block truncate max-w-[250px]" title={title}>
                        {title}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${category.color}`}>
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {category.label}
                        </Badge>
                        {tenantName && category.filterValue !== "identite" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-violet-50 text-violet-700 border-violet-200">
                            👤 {tenantName}
                          </Badge>
                        )}
                        {!tenantName && (
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{typeLabel}</span>
                        )}
                      </div>
                  </div>
              </div>
            );
        }
    },
    {
        header: "Bien associé",
        cell: (doc: any) => (
            <span className="text-sm text-muted-foreground font-medium">
                {doc.properties?.adresse_complete || doc.property?.adresse_complete || "Général"}
            </span>
        )
    },
    {
        header: "Date",
        cell: (doc: any) => (
            <span className="text-sm text-muted-foreground">
                {doc.created_at ? formatDateShort(doc.created_at) : "-"}
            </span>
        )
    },
    {
        header: "Statut",
        className: "text-right",
        cell: (doc: any) => (
            <div className="flex justify-end">
                <StatusBadge 
                    status="Actif" 
                    type="success"
                    className="w-fit"
                />
            </div>
        )
    },
    {
        header: "Actions",
        className: "text-right",
        cell: (doc: any) => (
            <div className="flex justify-end gap-1" role="group" aria-label="Actions sur le document">
                {/* Prévisualiser */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 hover:bg-blue-50 hover:text-blue-600"
                    onClick={() => openPreview(doc)}
                    aria-label={`Prévisualiser ${doc.title || getTypeLabel(doc.type || "")}`}
                >
                    <Eye className="h-4 w-4" />
                </Button>
                {/* Télécharger */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => handleDownload(doc)}
                    aria-label={`Télécharger ${doc.title || getTypeLabel(doc.type || "")}`}
                >
                    <Download className="h-4 w-4" />
                </Button>
                {/* Supprimer */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 hover:bg-red-50 hover:text-red-600"
                    onClick={() => openDeleteDialog(doc)}
                    aria-label={`Supprimer ${doc.title || getTypeLabel(doc.type || "")}`}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        )
    }
  ];

  return (
    <PageTransition>
      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Supprimer ce document ?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span className="block">Vous êtes sur le point de supprimer :</span>
                <span className="block font-medium text-foreground">
                  {documentToDelete?.title || getTypeLabel(documentToDelete?.type || "")}
                </span>
                <span className="block text-red-600 font-medium mt-4">
                  ⚠️ Cette action est irréversible !
                </span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDocumentMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={deleteDocumentMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-background min-h-screen">
        <div className="space-y-8 container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Documents
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Bibliothèque et coffre-fort de vos documents
              </p>
            </div>
            <div className="flex items-center gap-3">
              {activeSection === "bibliotheque" && (
                <>
                  {/* Toggle vue */}
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "cascade")} className="bg-card/80 rounded-lg border shadow-sm">
                    <TabsList className="grid grid-cols-2 h-9">
                      <TabsTrigger value="cascade" className="flex items-center gap-1.5 text-xs px-3">
                        <Home className="h-3.5 w-3.5" />
                        Par bien
                      </TabsTrigger>
                      <TabsTrigger value="table" className="flex items-center gap-1.5 text-xs px-3">
                        <List className="h-3.5 w-3.5" />
                        Liste
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button asChild className="shadow-lg hover:shadow-xl transition-all duration-300 bg-indigo-600 hover:bg-indigo-700">
                    <Link href={ownerDocumentRoutes.upload()}>
                      <Upload className="mr-2 h-4 w-4" />
                      Téléverser
                    </Link>
                  </Button>
                </>
              )}
              {activeSection === "coffre-fort" && (
                <Button className="gap-2" onClick={() => setGedUploadOpen(true)}>
                  <Upload className="h-4 w-4" />
                  Ajouter un document
                </Button>
              )}
            </div>
          </div>

          {/* SOTA 2026 — Onglets de section : Bibliothèque | Coffre-fort | Alertes */}
          <Tabs
            value={activeSection}
            onValueChange={(v) => setActiveSection(v as "bibliotheque" | "coffre-fort" | "alertes")}
          >
            <TabsList className="grid w-full grid-cols-3 max-w-lg">
              <TabsTrigger value="bibliotheque" className="gap-1.5 text-xs sm:text-sm">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Bibliothèque</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="coffre-fort" className="gap-1.5 text-xs sm:text-sm">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Coffre-fort</span>
                <span className="sm:hidden">Coffre</span>
              </TabsTrigger>
              <TabsTrigger value="alertes" className="gap-1.5 text-xs sm:text-sm relative">
                <Bell className="h-4 w-4" />
                <span>Alertes</span>
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 font-bold">
                    {alertCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* ============ SECTION: Coffre-fort (GED) ============ */}
          {activeSection === "coffre-fort" && (
            <div className="space-y-6">
              {/* Alerts summary */}
              <AlertsPanel
                summary={alertsSummary}
                isLoading={isLoadingAlerts}
                onUploadNew={handleGedUploadForType}
                onViewDocument={(id) => {
                  const doc = gedDocuments.find((d) => d.id === id);
                  if (doc) openPreview(doc);
                }}
              />

              {/* View switcher */}
              <Tabs
                value={gedViewMode}
                onValueChange={(v) => setGedViewMode(v as GedViewMode)}
              >
                <TabsList className="grid w-full grid-cols-2 max-w-xs">
                  <TabsTrigger value="quick" className="gap-1.5 text-xs sm:text-sm">
                    <FolderOpen className="h-4 w-4" />
                    Par bien
                  </TabsTrigger>
                  <TabsTrigger value="type" className="gap-1.5 text-xs sm:text-sm">
                    <List className="h-4 w-4" />
                    Par type
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Views */}
              {gedViewMode === "quick" && (
                <QuickView
                  documents={gedDocuments}
                  isLoading={isLoadingGed}
                  onPreview={(doc: any) => openPreview(doc)}
                  onDownload={(doc: any) => handleDownload(doc)}
                  onDelete={(doc: any) => openDeleteDialog(doc)}
                />
              )}

              {gedViewMode === "type" && (
                <TypeView
                  documents={gedDocuments}
                  isLoading={isLoadingGed}
                  onPreview={(doc: any) => openPreview(doc)}
                  onDownload={(doc: any) => handleDownload(doc)}
                  onDelete={(doc: any) => openDeleteDialog(doc)}
                />
              )}
            </div>
          )}

          {/* ============ SECTION: Alertes ============ */}
          {activeSection === "alertes" && (
            <div className="space-y-6">
              <AlertsPanel
                summary={alertsSummary}
                isLoading={isLoadingAlerts}
                onUploadNew={handleGedUploadForType}
                onViewDocument={(id) => {
                  const doc = gedDocuments.find((d) => d.id === id);
                  if (doc) openPreview(doc);
                }}
              />

              {/* Détail des alertes par statut d'expiration */}
              {isLoadingGed ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (() => {
                const alertDocs = gedDocuments.filter(
                  (d) =>
                    d.expiry_status === "expired" ||
                    d.expiry_status === "expiring_soon" ||
                    d.expiry_status === "expiring_notice"
                );

                // Ajouter les assurances expirées de la bibliothèque (legacy)
                const legacyAlerts: typeof alertDocs = legacyInsuranceAlerts
                  .filter((doc: any) => !gedDocuments.some((g) => g.id === doc.id))
                  .map((doc: any) => ({
                    ...doc,
                    expiry_status: "expired" as const,
                    type_label: getTypeLabel(doc.type || ""),
                    title: doc.title || getTypeLabel(doc.type || ""),
                    property: doc.properties || doc.property,
                    valid_until: doc.expiry_date || doc.created_at,
                  }));
                const allAlertDocs = [...alertDocs, ...legacyAlerts];

                const sortOrder = { expired: 0, expiring_soon: 1, expiring_notice: 2 };
                allAlertDocs.sort(
                  (a, b) =>
                    (sortOrder[a.expiry_status as keyof typeof sortOrder] ?? 3) -
                    (sortOrder[b.expiry_status as keyof typeof sortOrder] ?? 3)
                );

                if (allAlertDocs.length === 0) {
                  return (
                    <EmptyState
                      title="Aucune alerte"
                      description="Tous vos documents sont à jour."
                      icon={Bell}
                    />
                  );
                }

                const expired = allAlertDocs.filter((d) => d.expiry_status === "expired");
                const expiringSoon = allAlertDocs.filter((d) => d.expiry_status === "expiring_soon");
                const expiringNotice = allAlertDocs.filter((d) => d.expiry_status === "expiring_notice");

                return (
                  <div className="space-y-6">
                    {expired.length > 0 && (
                      <GlassCard className="border-rose-200 dark:border-rose-800">
                        <div className="px-4 py-2.5 bg-rose-50/50 border-b border-rose-200">
                          <h3 className="text-sm font-semibold text-rose-700">Documents expirés ({expired.length})</h3>
                        </div>
                        <div className="p-3 space-y-2">
                          {expired.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-accent/50 transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{doc.title || doc.type_label || "Document"}</p>
                                <p className="text-xs text-muted-foreground">{doc.property?.adresse_complete || "Document général"}{doc.valid_until && ` — Exp. ${doc.valid_until}`}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleGedUploadForType(doc.type)}>
                                  <Upload className="h-3 w-3" />
                                  Remplacer
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openPreview(doc)}>
                                  Voir
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    )}
                    {expiringSoon.length > 0 && (
                      <GlassCard className="border-amber-200 dark:border-amber-800">
                        <div className="px-4 py-2.5 bg-amber-50/50 border-b border-amber-200">
                          <h3 className="text-sm font-semibold text-amber-700">Expirent dans 30 jours ({expiringSoon.length})</h3>
                        </div>
                        <div className="p-3 space-y-2">
                          {expiringSoon.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-accent/50 transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{doc.title || doc.type_label || "Document"}</p>
                                <p className="text-xs text-muted-foreground">{doc.property?.adresse_complete || "Document général"}{doc.valid_until && ` — Exp. ${doc.valid_until}`}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleGedUploadForType(doc.type)}>
                                  <Upload className="h-3 w-3" />
                                  Remplacer
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openPreview(doc)}>
                                  Voir
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    )}
                    {expiringNotice.length > 0 && (
                      <GlassCard className="border-blue-200 dark:border-blue-800">
                        <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-200">
                          <h3 className="text-sm font-semibold text-blue-700">À renouveler sous 90 jours ({expiringNotice.length})</h3>
                        </div>
                        <div className="p-3 space-y-2">
                          {expiringNotice.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-accent/50 transition-colors">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{doc.title || doc.type_label || "Document"}</p>
                                <p className="text-xs text-muted-foreground">{doc.property?.adresse_complete || "Document général"}{doc.valid_until && ` — Exp. ${doc.valid_until}`}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleGedUploadForType(doc.type)}>
                                  <Upload className="h-3 w-3" />
                                  Remplacer
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openPreview(doc)}>
                                  Voir
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ============ SECTION: Bibliothèque (vue originale) ============ */}
          {activeSection === "bibliotheque" && <>
          {/* Filtres */}
          <GlassCard className="p-4">
            <div className="grid gap-4 md:grid-cols-6">
                <div className="md:col-span-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Rechercher par nom, type ou adresse..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-card border-border"
                    aria-label="Rechercher dans les documents"
                    />
                </div>
                </div>
                {/* Filtre par catégorie */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-card border-border">
                    <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                    {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
                {/* Filtre par source (inter-compte) */}
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Toutes les sources</SelectItem>
                    <SelectItem value="owner">Mes documents</SelectItem>
                    <SelectItem value="tenant">Documents locataires</SelectItem>
                </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                        {label}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(DOCUMENT_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                        {label}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
          </GlassCard>

          {/* Liste des documents */}
          {isLoading ? (
            <GlassCard className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            </GlassCard>
          ) : filteredDocuments.length === 0 ? (
            <EmptyState 
                title="Aucun document"
                description="Téléversez vos baux, quittances et diagnostics pour les retrouver ici."
                icon={FileText}
                action={{
                    label: "Téléverser un document",
                    href: ownerDocumentRoutes.upload(),
                    variant: "outline"
                }}
            />
          ) : viewMode === "cascade" ? (
            /* 🏠 Vue cascade groupée par bien */
            <DocumentGroups
              documents={filteredDocuments.map((doc: any) => ({
                ...doc,
                properties: doc.properties || doc.property,
                tenant: doc.tenant,
              }))}
              groupBy="property"
              onPreview={openPreview}
              onDownload={handleDownload}
              onDelete={openDeleteDialog}
            />
          ) : (
            /* 📋 Vue tableau classique */
            <GlassCard className="p-0 overflow-hidden shadow-md">
                <ResponsiveTable 
                    data={filteredDocuments}
                    columns={columns}
                    keyExtractor={(doc) => doc.id}
                />
            </GlassCard>
          )}
          </>}
        </div>
      </div>

      {/* GED Upload Dialog (Coffre-fort) */}
      <GedUploadDialog
        open={gedUploadOpen}
        onOpenChange={(open) => {
          setGedUploadOpen(open);
          if (!open) setGedUploadDefaultType(undefined);
        }}
        defaultType={gedUploadDefaultType as any}
        defaultPropertyId={propertyIdFilter}
        defaultLeaseId={leaseIdFilter}
        properties={properties}
      />

      {/* Modal de prévisualisation PDF */}
      <PDFPreviewModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl(null);
        }}
        documentUrl={previewUrl}
        documentTitle={previewDocument ? formatDocumentTitle(previewDocument) : "Document"}
        documentType={previewDocument?.type}
      />
    </PageTransition>
  );
}

"use client";
// @ts-nocheck

import { useState } from "react";
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
import { Search, FileText, Upload, Download, Trash2, Eye, Tag, FolderOpen, Loader2 } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { DOCUMENT_TYPES, DOCUMENT_STATUS_LABELS } from "@/lib/owner/constants";
import { ownerDocumentRoutes } from "@/lib/owner/routes";
import { useToast } from "@/components/ui/use-toast";

// React Query hooks pour la réactivité
import { useDocuments, useDeleteDocument } from "@/lib/hooks/use-documents";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { PDFPreviewModal } from "@/components/documents/pdf-preview-modal";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Props optionnel pour compatibilité
interface OwnerDocumentsClientProps {
  initialDocuments?: any[];
}

export function OwnerDocumentsClient({ initialDocuments }: OwnerDocumentsClientProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const propertyIdFilter = searchParams.get("property_id");
  const leaseIdFilter = searchParams.get("lease_id");

  // ✅ React Query : données réactives avec mise à jour automatique
  const { data: documents = [], isLoading } = useDocuments({
    propertyId: propertyIdFilter,
    leaseId: leaseIdFilter,
  });
  const deleteDocumentMutation = useDeleteDocument();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
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
          description: error.message || "Impossible de supprimer le document",
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
      piece_identite: { label: "Identité", filterValue: "identite", color: "bg-slate-100 text-slate-700 border-slate-200" },
      cni_recto: { label: "Identité", filterValue: "identite", color: "bg-slate-100 text-slate-700 border-slate-200" },
      cni_verso: { label: "Identité", filterValue: "identite", color: "bg-slate-100 text-slate-700 border-slate-200" },
      passeport: { label: "Identité", filterValue: "identite", color: "bg-slate-100 text-slate-700 border-slate-200" },
      justificatif_domicile: { label: "Identité", filterValue: "identite", color: "bg-slate-100 text-slate-700 border-slate-200" },
      rib: { label: "Identité", filterValue: "identite", color: "bg-slate-100 text-slate-700 border-slate-200" },
      // Autres
      courrier: { label: "Courrier", filterValue: "courrier", color: "bg-pink-100 text-pink-700 border-pink-200" },
      photo: { label: "Photo", filterValue: "autre", color: "bg-amber-100 text-amber-700 border-amber-200" },
    };
    return categories[type] || { label: "Autre", filterValue: "autre", color: "bg-gray-100 text-gray-700 border-gray-200" };
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
                      <span className="font-semibold text-slate-900 block truncate max-w-[250px]" title={title}>
                        {title}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${category.color}`}>
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {category.label}
                        </Badge>
                        {tenantName && category.filterValue !== "identite" && (
                          <span className="text-[10px] text-muted-foreground">
                            👤 {tenantName}
                          </span>
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
            <span className="text-sm text-slate-600 font-medium">
                {doc.properties?.adresse_complete || doc.property?.adresse_complete || "Général"}
            </span>
        )
    },
    {
        header: "Date",
        cell: (doc: any) => (
            <span className="text-sm text-slate-500">
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
            <div className="flex justify-end gap-1">
                {/* Prévisualiser */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                    onClick={() => openPreview(doc)}
                    title="Prévisualiser"
                >
                    <Eye className="h-4 w-4" />
                </Button>
                {/* Télécharger */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => handleDownload(doc)}
                    title="Télécharger"
                >
                    <Download className="h-4 w-4" />
                </Button>
                {/* Supprimer */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                    onClick={() => openDeleteDialog(doc)}
                    title="Supprimer"
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
                <span className="block font-medium text-slate-900">
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

      <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
        <div className="space-y-8 container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
                Documents
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Bibliothèque de tous vos documents
              </p>
            </div>
            <Button asChild className="shadow-lg hover:shadow-xl transition-all duration-300 bg-indigo-600 hover:bg-indigo-700">
              <Link href={ownerDocumentRoutes.upload()}>
                <Upload className="mr-2 h-4 w-4" />
                Téléverser
              </Link>
            </Button>
          </div>

          {/* Filtres */}
          <GlassCard className="p-4">
            <div className="grid gap-4 md:grid-cols-5">
                <div className="md:col-span-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Rechercher par nom, type ou adresse..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white border-slate-200"
                    />
                </div>
                </div>
                {/* Filtre par catégorie */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-white border-slate-200">
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-white border-slate-200">
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
                <SelectTrigger className="bg-white border-slate-200">
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
          ) : (
            <GlassCard className="p-0 overflow-hidden shadow-md">
                <ResponsiveTable 
                    data={filteredDocuments}
                    columns={columns}
                    keyExtractor={(doc) => doc.id}
                />
            </GlassCard>
          )}
        </div>
      </div>
      
      {/* Modal de prévisualisation PDF */}
      <PDFPreviewModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl(null);
        }}
        documentUrl={previewUrl}
        documentTitle={previewDocument?.title || getTypeLabel(previewDocument?.type || "")}
        documentType={previewDocument?.type}
      />
    </PageTransition>
  );
}

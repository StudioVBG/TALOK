"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Upload, FolderOpen, Building2, List, Bell,
  Download, Loader2,
} from "lucide-react";
import { QuickView } from "@/components/ged/quick-view";
import { TypeView } from "@/components/ged/type-view";
import { AlertsPanel } from "@/components/ged/alerts-panel";
import { GedUploadDialog } from "@/components/ged/ged-upload-dialog";
import { PDFPreviewModal } from "@/components/documents/pdf-preview-modal";
import { useGedDocuments, useGedDeleteDocument } from "@/lib/hooks/use-ged-documents";
import { useGedAlertsSummary } from "@/lib/hooks/use-ged-alerts";
import type { GedDocument, GedViewMode } from "@/lib/types/ged";

interface GedClientProps {
  properties?: Array<{ id: string; adresse_complete: string; ville: string }>;
}

export function GedClient({ properties }: GedClientProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Filters from URL
  const propertyIdFilter = searchParams.get("property_id");
  const leaseIdFilter = searchParams.get("lease_id");

  // Data
  const { data: documents = [], isLoading: isLoadingDocs } = useGedDocuments({
    propertyId: propertyIdFilter,
    leaseId: leaseIdFilter,
  });
  const { data: alertsSummary, isLoading: isLoadingAlerts } = useGedAlertsSummary();
  const deleteDocMutation = useGedDeleteDocument();

  // UI State
  const [viewMode, setViewMode] = useState<GedViewMode>("quick");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefaultType, setUploadDefaultType] = useState<string | undefined>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<GedDocument | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<GedDocument | null>(null);

  // Alert badge count
  const alertCount = alertsSummary
    ? alertsSummary.expired_count + alertsSummary.expiring_soon_count
    : 0;

  // Handlers
  const handlePreview = useCallback(async (doc: GedDocument) => {
    setPreviewDocument(doc);
    setIsLoadingPreview(true);
    setPreviewOpen(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url || data.signedUrl);
      }
    } catch {
      toast({ title: "Impossible de charger l'aperçu", variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [toast]);

  const handleDownload = useCallback(async (doc: GedDocument) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (res.ok) {
        const data = await res.json();
        const url = data.url || data.signedUrl;
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.download = doc.original_filename || doc.title || "document";
          link.click();
        }
      }
    } catch {
      toast({ title: "Erreur de téléchargement", variant: "destructive" });
    }
  }, [toast]);

  const handleDeleteConfirm = useCallback(() => {
    if (!documentToDelete) return;
    deleteDocMutation.mutate(documentToDelete.id, {
      onSuccess: () => {
        toast({ title: "Document supprimé" });
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
      },
      onError: () => {
        toast({ title: "Erreur de suppression", variant: "destructive" });
      },
    });
  }, [documentToDelete, deleteDocMutation, toast]);

  const handleUploadForType = useCallback((docType: string) => {
    setUploadDefaultType(docType);
    setUploadOpen(true);
  }, []);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GED - Documents</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestion centralisée de vos documents immobiliers
            </p>
          </div>
          <Button className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Ajouter un document
          </Button>
        </div>

        {/* Alerts summary */}
        <AlertsPanel
          summary={alertsSummary}
          isLoading={isLoadingAlerts}
          onUploadNew={handleUploadForType}
          onViewDocument={(id) => {
            const doc = documents.find((d) => d.id === id);
            if (doc) handlePreview(doc);
          }}
        />

        {/* View switcher */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as GedViewMode)}
        >
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="quick" className="gap-1.5 text-xs sm:text-sm">
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Par bien</span>
              <span className="sm:hidden">Biens</span>
            </TabsTrigger>
            <TabsTrigger value="type" className="gap-1.5 text-xs sm:text-sm">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Par type</span>
              <span className="sm:hidden">Types</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5 text-xs sm:text-sm relative">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alertes</span>
              <span className="sm:hidden">Alertes</span>
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 font-bold">
                  {alertCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Views */}
        {viewMode === "quick" && (
          <QuickView
            documents={documents}
            isLoading={isLoadingDocs}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onDelete={(doc) => {
              setDocumentToDelete(doc);
              setDeleteDialogOpen(true);
            }}
          />
        )}

        {viewMode === "type" && (
          <TypeView
            documents={documents}
            isLoading={isLoadingDocs}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onDelete={(doc) => {
              setDocumentToDelete(doc);
              setDeleteDialogOpen(true);
            }}
          />
        )}

        {viewMode === "alerts" && (
          <AlertsDetailView
            alertsSummary={alertsSummary}
            isLoading={isLoadingAlerts}
            documents={documents}
            onUploadNew={handleUploadForType}
            onPreview={handlePreview}
          />
        )}

        {/* Upload Dialog */}
        <GedUploadDialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) setUploadDefaultType(undefined);
          }}
          defaultType={uploadDefaultType as any}
          defaultPropertyId={propertyIdFilter}
          defaultLeaseId={leaseIdFilter}
          properties={properties}
        />

        {/* PDF Preview Modal */}
        {previewOpen && previewDocument && (
          <PDFPreviewModal
            isOpen={previewOpen}
            onClose={() => {
              setPreviewOpen(false);
              setPreviewDocument(null);
              setPreviewUrl(null);
            }}
            documentUrl={previewUrl || ""}
            documentTitle={previewDocument.title || previewDocument.type_label || "Document"}
          />
        )}

        {/* Delete confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
              <AlertDialogDescription>
                {documentToDelete
                  ? `"${documentToDelete.title || documentToDelete.type_label || "Document"}" sera supprimé définitivement.`
                  : "Ce document sera supprimé définitivement."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteDocMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  );
}

/**
 * Vue détaillée des alertes (onglet Alertes)
 */
function AlertsDetailView({
  alertsSummary,
  isLoading,
  documents,
  onUploadNew,
  onPreview,
}: {
  alertsSummary: any;
  isLoading: boolean;
  documents: GedDocument[];
  onUploadNew: (type: string) => void;
  onPreview: (doc: GedDocument) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Show all alerting documents as full cards
  const alertDocs = documents.filter(
    (d) =>
      d.expiry_status === "expired" ||
      d.expiry_status === "expiring_soon" ||
      d.expiry_status === "expiring_notice"
  );

  // Sort: expired first, then expiring_soon, then expiring_notice
  const sortOrder = { expired: 0, expiring_soon: 1, expiring_notice: 2 };
  alertDocs.sort(
    (a, b) =>
      (sortOrder[a.expiry_status as keyof typeof sortOrder] ?? 3) -
      (sortOrder[b.expiry_status as keyof typeof sortOrder] ?? 3)
  );

  if (alertDocs.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-semibold mb-1">Aucune alerte</h3>
        <p className="text-sm text-muted-foreground">
          Tous vos documents sont à jour. Beau travail !
        </p>
      </div>
    );
  }

  // Group by expiry status
  const expired = alertDocs.filter((d) => d.expiry_status === "expired");
  const expiringSoon = alertDocs.filter((d) => d.expiry_status === "expiring_soon");
  const expiringNotice = alertDocs.filter((d) => d.expiry_status === "expiring_notice");

  return (
    <div className="space-y-6">
      {expired.length > 0 && (
        <AlertGroup
          title={`Documents expirés (${expired.length})`}
          variant="error"
          documents={expired}
          onUploadNew={onUploadNew}
          onPreview={onPreview}
        />
      )}
      {expiringSoon.length > 0 && (
        <AlertGroup
          title={`Expirent dans 30 jours (${expiringSoon.length})`}
          variant="warning"
          documents={expiringSoon}
          onUploadNew={onUploadNew}
          onPreview={onPreview}
        />
      )}
      {expiringNotice.length > 0 && (
        <AlertGroup
          title={`À renouveler sous 90 jours (${expiringNotice.length})`}
          variant="info"
          documents={expiringNotice}
          onUploadNew={onUploadNew}
          onPreview={onPreview}
        />
      )}
    </div>
  );
}

function AlertGroup({
  title,
  variant,
  documents,
  onUploadNew,
  onPreview,
}: {
  title: string;
  variant: "error" | "warning" | "info";
  documents: GedDocument[];
  onUploadNew: (type: string) => void;
  onPreview: (doc: GedDocument) => void;
}) {
  const borderStyles = {
    error: "border-rose-200 dark:border-rose-800",
    warning: "border-amber-200 dark:border-amber-800",
    info: "border-blue-200 dark:border-blue-800",
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${borderStyles[variant]}`}>
      <div className="px-4 py-2.5 bg-muted/30 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-3 space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-3 rounded-md border bg-background hover:bg-accent/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {doc.title || doc.type_label || "Document"}
              </p>
              <p className="text-xs text-muted-foreground">
                {doc.property?.adresse_complete || "Document général"}
                {doc.valid_until && ` — Exp. ${doc.valid_until}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => onUploadNew(doc.type)}
              >
                <Upload className="h-3 w-3" />
                Remplacer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onPreview(doc)}
              >
                Voir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

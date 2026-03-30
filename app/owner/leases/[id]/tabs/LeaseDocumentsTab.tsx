"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileText,
  FolderOpen,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Upload,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  MoreHorizontal,
  Shield,
  Zap,
  ClipboardCheck,
  File,
  Wrench,
  Receipt,
  CheckCircle,
  Clock,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/components/ui/use-toast";
import {
  LEASE_DOCUMENT_TYPE_MAP,
  REQUIRED_LEASE_DOCUMENT_TYPES,
  LEASE_DOCUMENT_STATUS_CONFIG,
  getLeaseDocumentUIStatus,
  type LeaseDocumentTypeConfig,
  type LeaseDocumentUIStatus,
} from "@/lib/config/lease-document-types";
import {
  toggleDocumentVisibility,
  archiveDocument,
} from "./actions/documents";
import { DocumentUploadDialog } from "./components/DocumentUploadDialog";
import type {
  LeaseReadinessState,
  LeaseWorkflowDocument,
} from "@/app/owner/_data/lease-readiness";
import { groupDocuments } from "@/lib/documents/group-documents";
import { GroupedDocumentCard } from "@/features/documents/components/grouped-document-card";

// ============================================
// TYPES
// ============================================

interface DocumentItem {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
  title?: string;
  name?: string;
  expiry_date?: string | null;
  is_archived?: boolean;
  visible_tenant?: boolean;
  mime_type?: string | null;
  file_size?: number | null;
}

interface LeaseDocumentsTabProps {
  leaseId: string;
  propertyId: string;
  documents: DocumentItem[];
  dpeStatus: { status: string; data?: any } | null;
  readinessState: LeaseReadinessState;
}

// ============================================
// ICON MAP (Lucide icons par nom)
// ============================================

const ICON_MAP: Record<string, typeof FileText> = {
  FileText,
  Shield,
  Zap,
  ClipboardCheck,
  AlertTriangle,
  Receipt,
  Wrench,
  File,
};

function getDocIcon(config: LeaseDocumentTypeConfig | undefined) {
  if (!config) return FileText;
  return ICON_MAP[config.icon] || FileText;
}

// ============================================
// FILTERS
// ============================================

type DocFilter = "all" | "required" | "optional" | "expired";

// ============================================
// MAIN COMPONENT
// ============================================

export function LeaseDocumentsTab({
  leaseId,
  propertyId,
  documents,
  dpeStatus,
  readinessState,
}: LeaseDocumentsTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<DocFilter>("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);

  // Séparer documents actifs vs archivés
  const activeDocs = useMemo(
    () => documents.filter((d) => !d.is_archived),
    [documents]
  );

  const workflowDocumentMap = useMemo(
    () => new Map(readinessState.workflowDocuments.map((doc) => [doc.key, doc])),
    [readinessState.workflowDocuments]
  );

  const requiredSlots = useMemo(() => {
    return REQUIRED_LEASE_DOCUMENT_TYPES.map((config) => ({
      config,
      docs: activeDocs.filter((d) => d.type === config.type),
      workflowDoc:
        config.type === "bail"
          ? workflowDocumentMap.get("contract")
          : config.type === "EDL_entree"
            ? workflowDocumentMap.get("edl")
            : config.type === "diagnostic_performance"
              ? workflowDocumentMap.get("dpe")
              : undefined,
      readinessStatus:
        config.type === "bail"
          ? readinessState.documentState.contract
          : config.type === "EDL_entree"
            ? readinessState.documentState.edl
            : config.type === "diagnostic_performance"
              ? readinessState.documentState.dpe
              : config.type === "attestation_assurance"
                ? readinessState.documentState.insurance
                : "missing",
    }));
  }, [activeDocs, workflowDocumentMap, readinessState.documentState]);

  // Documents optionnels : tous les actifs dont le type n'est pas dans les requis
  const requiredTypes = useMemo(
    () => new Set(REQUIRED_LEASE_DOCUMENT_TYPES.map((c) => c.type)),
    []
  );
  const optionalDocs = useMemo(
    () => activeDocs.filter((d) => !requiredTypes.has(d.type as any)),
    [activeDocs, requiredTypes]
  );

  // Stats
  const completedRequired = requiredSlots.filter(
    ({ docs, readinessStatus }) =>
      docs.some((doc) => {
        const config = LEASE_DOCUMENT_TYPE_MAP[doc.type];
        return config ? getLeaseDocumentUIStatus(doc, config) === "valid" : true;
      }) ||
      readinessStatus === "available"
  ).length;
  const totalRequired = requiredSlots.length;
  const expiredDocs = activeDocs.filter((d) => {
    const config = LEASE_DOCUMENT_TYPE_MAP[d.type];
    return config && getLeaseDocumentUIStatus(d, config) === "expired";
  });

  // Filtrage
  const filteredRequired = useMemo(() => {
    switch (filter) {
      case "required":
        return requiredSlots.filter(
          ({ docs, readinessStatus }) =>
            !docs.length &&
            !["available", "pending_workflow", "in_progress"].includes(
              readinessStatus
            )
        );
      case "expired":
        return requiredSlots.filter(({ docs, readinessStatus }) => {
          if (readinessStatus === "expired") return true;
          return docs.some((d) => {
            const config = LEASE_DOCUMENT_TYPE_MAP[d.type];
            return (
              config && getLeaseDocumentUIStatus(d, config) === "expired"
            );
          });
        });
      default:
        return requiredSlots;
    }
  }, [filter, requiredSlots]);

  const filteredOptional = useMemo(() => {
    if (filter === "required") return [];
    if (filter === "expired") {
      return optionalDocs.filter((d) => {
        const config = LEASE_DOCUMENT_TYPE_MAP[d.type];
        return config && getLeaseDocumentUIStatus(d, config) === "expired";
      });
    }
    if (filter === "optional") return optionalDocs;
    return optionalDocs;
  }, [filter, optionalDocs]);

  // Handlers
  const handleToggleVisibility = (doc: DocumentItem) => {
    startTransition(async () => {
      try {
        await toggleDocumentVisibility(
          doc.id,
          leaseId,
          !doc.visible_tenant
        );
        toast({
          title: doc.visible_tenant
            ? "Document masqué"
            : "Document visible",
          description: doc.visible_tenant
            ? "Le locataire ne verra plus ce document."
            : "Le locataire peut maintenant voir ce document.",
        });
        router.refresh();
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de modifier la visibilité.",
          variant: "destructive",
        });
      }
    });
  };

  const handleDelete = (doc: DocumentItem) => {
    setDeleteTarget(doc);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/documents/${deleteTarget.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Erreur suppression");
        toast({
          title: "Document supprimé",
          description: `"${getDocLabel(deleteTarget)}" a été supprimé.`,
        });
        router.refresh();
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le document.",
          variant: "destructive",
        });
      } finally {
        setDeleteTarget(null);
      }
    });
  };

  const handleReplace = (doc: DocumentItem) => {
    // Archive l'ancien document puis ouvre l'upload dialog avec le même type pré-sélectionné
    startTransition(async () => {
      try {
        await archiveDocument(doc.id, leaseId);
        setUploadOpen(true);
        router.refresh();
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible d'archiver l'ancien document.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 py-4"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Documents du bail
          </span>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {activeDocs.length}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {completedRequired}/{totalRequired} requis
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setUploadOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-1.5 flex-wrap">
        {(
          [
            { key: "all" as const, label: "Tous" },
            {
              key: "required" as const,
              label: "Manquants",
              count: totalRequired - completedRequired,
            },
            { key: "optional" as const, label: "Optionnels" },
            {
              key: "expired" as const,
              label: "Expirés",
              count: expiredDocs.length,
            },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f.key
                ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                : "border-border text-muted-foreground hover:border-border"
            }`}
          >
            {f.label}
            {"count" in f && f.count > 0 && (
              <span className="ml-1 text-[10px] font-bold">({f.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Alerte DPE si manquant */}
      {dpeStatus?.status !== "VALID" && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                DPE {dpeStatus?.status === "EXPIRED" ? "expiré" : "manquant"}
              </p>
              <p className="text-xs text-amber-700">
                Obligatoire pour le bail (loi Climat 2021)
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
            asChild
          >
            <Link href={`/owner/properties/${propertyId}/diagnostics`}>
              <ShieldAlert className="h-4 w-4 mr-2" />
              Ajouter
            </Link>
          </Button>
        </div>
      )}

      {/* Section: Documents requis */}
      {(filter === "all" || filter === "required" || filter === "expired") && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
            Documents obligatoires
          </p>
          <div className="space-y-1.5">
            {filteredRequired.map(({ config, docs, workflowDoc, readinessStatus }) =>
              docs.length > 0 ? (
                docs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    config={config}
                    isPending={isPending}
                    onToggleVisibility={() => handleToggleVisibility(doc)}
                    onDelete={() => handleDelete(doc)}
                    onReplace={() => handleReplace(doc)}
                  />
                ))
              ) : workflowDoc &&
                ["available", "pending_workflow", "in_progress", "expired"].includes(
                  readinessStatus
                ) ? (
                <WorkflowDocumentRow
                  key={config.type}
                  config={config}
                  workflowDoc={workflowDoc}
                  readinessStatus={readinessStatus}
                />
              ) : (
                <MissingDocumentRow
                  key={config.type}
                  config={config}
                  leaseId={leaseId}
                  propertyId={propertyId}
                  onUpload={() => setUploadOpen(true)}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* Section: Documents optionnels — groupés (CNI recto/verso, etc.) */}
      {filteredOptional.length > 0 &&
        filter !== "required" && (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Annexes &amp; optionnels ({filteredOptional.length})
            </p>
            <div className="space-y-1.5">
              {groupDocuments(filteredOptional as any).map((item) => {
                if (item.kind === "group") {
                  return (
                    <GroupedDocumentCard
                      key={item.key}
                      item={item}
                      onDelete={() => router.refresh()}
                    />
                  );
                }
                const doc = item.document as DocumentItem;
                const config = LEASE_DOCUMENT_TYPE_MAP[doc.type];
                return (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    config={config}
                    isPending={isPending}
                    onToggleVisibility={() =>
                      handleToggleVisibility(doc)
                    }
                    onDelete={() => handleDelete(doc)}
                    onReplace={() => handleReplace(doc)}
                  />
                );
              })}
            </div>
          </div>
        )}

      {/* Empty state */}
      {activeDocs.length === 0 && filter === "all" && (
        <div className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucun document lié à ce bail
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Ajouter un document
          </Button>
        </div>
      )}

      {/* Footer: compteur + lien GED */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {activeDocs.length} document{activeDocs.length > 1 ? "s" : ""}{" "}
          actif{activeDocs.length > 1 ? "s" : ""}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed"
          asChild
        >
          <Link href={`/owner/documents?lease_id=${leaseId}`}>
            <FolderOpen className="h-3.5 w-3.5 mr-2" />
            Gérer tous les documents
          </Link>
        </Button>
      </div>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        leaseId={leaseId}
        propertyId={propertyId}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le document &quot;{deleteTarget && getDocLabel(deleteTarget)}
              &quot; sera définitivement supprimé. Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

// ============================================
// DOCUMENT ROW
// ============================================

function DocumentRow({
  doc,
  config,
  isPending,
  onToggleVisibility,
  onDelete,
  onReplace,
}: {
  doc: DocumentItem;
  config: LeaseDocumentTypeConfig | undefined;
  isPending: boolean;
  onToggleVisibility: () => void;
  onDelete: () => void;
  onReplace: () => void;
}) {
  const status: LeaseDocumentUIStatus = config
    ? getLeaseDocumentUIStatus(doc, config)
    : "valid";
  const statusConfig = LEASE_DOCUMENT_STATUS_CONFIG[status];
  const Icon = getDocIcon(config);
  const canDelete = config?.canDelete ?? true;
  const canReplace = config?.canReplace ?? true;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted transition-colors group ${
        isPending ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <div className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {getDocLabel(doc)}
          </p>
          {status !== "valid" && (
            <Badge
              variant="outline"
              className={`text-[10px] h-4 px-1.5 border-0 ${statusConfig.bgColor} ${statusConfig.textColor}`}
            >
              {statusConfig.label}
            </Badge>
          )}
          {doc.visible_tenant === false && (
            <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ajouté le{" "}
          {new Date(doc.created_at).toLocaleDateString("fr-FR")}
          {doc.expiry_date &&
            ` · Expire le ${new Date(doc.expiry_date).toLocaleDateString("fr-FR")}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
          <a
            href={`/api/documents/view?path=${encodeURIComponent(doc.storage_path)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Voir"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <a
                href={`/api/documents/view?path=${encodeURIComponent(doc.storage_path)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/documents/download?path=${encodeURIComponent(doc.storage_path)}&filename=${encodeURIComponent(getDocLabel(doc))}`}
                download
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleVisibility}>
              {doc.visible_tenant ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Masquer au locataire
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Rendre visible au locataire
                </>
              )}
            </DropdownMenuItem>
            {canReplace && (
              <DropdownMenuItem onClick={onReplace}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Remplacer
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================
// WORKFLOW DOCUMENT ROW
// ============================================

function WorkflowDocumentRow({
  config,
  workflowDoc,
  readinessStatus,
}: {
  config: LeaseDocumentTypeConfig;
  workflowDoc: LeaseWorkflowDocument;
  readinessStatus: string;
}) {
  const Icon = getDocIcon(config);
  const statusLabel =
    readinessStatus === "available"
      ? "Déjà disponible"
      : readinessStatus === "expired"
        ? "À renouveler"
        : readinessStatus === "in_progress"
          ? "Généré à la fin du workflow"
          : "Produit par le workflow";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/80">
      <div className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{config.label}</p>
          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
            {workflowDoc.source === "diagnostics" ? "Diagnostics" : "Workflow"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-5 px-1.5 border-0",
              readinessStatus === "available"
                ? "bg-emerald-100 text-emerald-700"
                : readinessStatus === "expired"
                  ? "bg-red-100 text-red-700"
                  : "bg-muted text-foreground"
            )}
          >
            {statusLabel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{workflowDoc.description}</p>
      </div>
      <div className="flex-shrink-0">
        {workflowDoc.storagePath ? (
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/api/documents/view?path=${encodeURIComponent(workflowDoc.storagePath)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Ouvrir
            </a>
          </Button>
        ) : workflowDoc.href ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={workflowDoc.href}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Voir
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// ============================================
// MISSING DOCUMENT ROW (slot vide pour un doc requis)
// ============================================

function MissingDocumentRow({
  config,
  leaseId,
  propertyId,
  onUpload,
}: {
  config: LeaseDocumentTypeConfig;
  leaseId: string;
  propertyId: string;
  onUpload: () => void;
}) {
  const Icon = getDocIcon(config);

  // Pour le DPE, on redirige vers la page diagnostics du bien
  const isDPE = config.type === "diagnostic_performance";

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-orange-200 bg-orange-50/50">
      <div className="h-9 w-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{config.label}</p>
        <p className="text-xs text-orange-500">Document requis non fourni</p>
      </div>
      {isDPE ? (
        <Button
          size="sm"
          variant="outline"
          className="border-orange-200 text-orange-700 hover:bg-orange-100 flex-shrink-0"
          asChild
        >
          <Link href={`/owner/properties/${propertyId}/diagnostics`}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="border-orange-200 text-orange-700 hover:bg-orange-100 flex-shrink-0"
          onClick={onUpload}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Ajouter
        </Button>
      )}
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function getDocLabel(doc: DocumentItem): string {
  if (doc.title) return doc.title;
  const config = LEASE_DOCUMENT_TYPE_MAP[doc.type];
  if (config) return config.label;
  return doc.name || doc.type;
}

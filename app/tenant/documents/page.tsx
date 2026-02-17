"use client";

/**
 * Document Center unifié — AUDIT UX H-01
 *
 * 3 zones :
 * 1. "À faire" — actions requises (bail à signer, assurance à déposer)
 * 2. "Documents clés" — 4 slots fixes (bail, dernière quittance, EDL, assurance)
 * 3. "Tous les documents" — recherche, filtres enrichis, grille/catégories
 *
 * Corrections intégrées :
 * - H-04 : Preview PDF inline (PDFPreviewModal au lieu de target="_blank")
 * - H-09 : Filtres enrichis (période, statut, tri)
 * - H-13 : Empty states contextuels avec CTA
 * - H-14 : prefers-reduced-motion
 */

import { useState, useMemo, useCallback } from "react";
import { useDocuments } from "@/lib/hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Eye,
  FolderOpen,
  Download,
  Filter,
  Loader2,
  Sparkles,
  LayoutGrid,
  Layers,
  PenTool,
  Shield,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowUpDown,
  RotateCcw,
  FileSignature,
  Receipt,
  FileCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentGroups } from "@/components/documents/document-groups";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { useTenantData } from "../_data/TenantDataProvider";
import { PDFPreviewModal } from "@/components/documents/pdf-preview-modal";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { DocumentCard, DOCUMENT_CONFIG, type DocumentCardDoc } from "@/components/documents/DocumentCard";
import Link from "next/link";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Détection intelligente du type de document */
function detectType(doc: any): string {
  const type = doc.type?.toLowerCase();
  if (type && DOCUMENT_CONFIG[type]) return type;

  const title = (doc.title || doc.metadata?.original_name || doc.name || "").toLowerCase();
  const storagePath = (doc.storage_path || "").toLowerCase();
  const searchText = `${title} ${storagePath}`;

  if (searchText.includes("quittance") || (searchText.includes("loyer") && !searchText.includes("attestation"))) return "quittance";
  if (searchText.includes("bail") || searchText.includes("contrat") || searchText.includes("lease")) return "bail";
  if (searchText.includes("assurance") || (searchText.includes("attestation") && searchText.includes("habitation"))) return "attestation_assurance";
  if (searchText.includes("edl") || searchText.includes("état des lieux") || searchText.includes("etat_lieux")) {
    if (searchText.includes("sortie") || searchText.includes("exit")) return "EDL_sortie";
    return "EDL_entree";
  }
  if (searchText.includes("dpe") || searchText.includes("performance énergétique")) return "dpe";
  if (searchText.includes("erp") || searchText.includes("risques")) return "erp";
  if (searchText.includes("plomb") || searchText.includes("crep")) return "crep";
  if (searchText.includes("amiante")) return "amiante";
  if (searchText.includes("électric") || searchText.includes("electric")) return "electricite";
  if (searchText.includes("gaz")) return "gaz";
  if (searchText.includes("cni") || searchText.includes("identité") || searchText.includes("passeport")) return "cni";
  if (searchText.includes("fiche de paie") || searchText.includes("bulletin") || searchText.includes("revenu")) return "justificatif_revenus";
  if (searchText.includes("facture") || searchText.includes("invoice")) return "facture";

  return type || "autre";
}

/** Titre lisible du document */
function getDocumentTitle(doc: any, config: { label: string }): string {
  const candidates = [doc.title, doc.name, doc.metadata?.original_name, doc.metadata?.title].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate && candidate.length > 0 && candidate !== "Document") {
      return candidate.replace(/\.(pdf|jpg|jpeg|png|doc|docx)$/i, "").replace(/_/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "";
  return date ? `${config.label} — ${date}` : config.label;
}

/** Vérifie si un document date de moins de 7 jours */
function isRecent(doc: any): boolean {
  if (!doc.created_at) return false;
  const diff = Date.now() - new Date(doc.created_at).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

// ──────────────────────────────────────────────
// Squelette de chargement
// ──────────────────────────────────────────────

function DocumentsSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      {/* Header skeleton */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      {/* Zone "À faire" skeleton */}
      <Skeleton className="h-24 rounded-2xl" />
      {/* Zone "Documents clés" skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {/* Zone "Tous les documents" skeleton */}
      <Skeleton className="h-14 rounded-xl" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Composant principal
// ──────────────────────────────────────────────

export default function TenantDocumentsPage() {
  const { data: documents = [], isLoading, error, refetch } = useDocuments();
  const { dashboard } = useTenantData();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "type">("date_desc");
  const [viewMode, setViewMode] = useState<"grid" | "cascade">("grid");

  // PDF Preview modal state (H-04)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState<string | undefined>();

  const leaseId = dashboard?.lease?.id;
  const propertyId = dashboard?.lease?.property_id;
  const hasLease = !!leaseId;

  // ── Actions requises (zone "À faire") ──
  const pendingActions = useMemo(() => {
    if (!dashboard) return [];
    const actions: Array<{ id: string; label: string; description: string; icon: React.ElementType; color: string; bgColor: string; href: string }> = [];

    // Bail à signer
    const leaseStatus = dashboard.lease?.statut;
    if (leaseStatus === "pending_signature" || leaseStatus === "partially_signed") {
      const leaseSigners = (dashboard.lease as any)?.lease_signers || (dashboard.lease as any)?.signers || [];
      const tenantSigner = (leaseSigners as any[])?.find(
        (s: any) => s.role === "locataire_principal" || s.role === "tenant" || s.role === "locataire"
      );
      const hasSignedLease = tenantSigner?.signature_status === "signed" || !!tenantSigner?.signed_at;
      if (!hasSignedLease) {
        actions.push({
          id: "sign-lease",
          label: "Signer mon bail",
          description: "Votre bail est prêt et attend votre signature.",
          icon: PenTool,
          color: "text-indigo-700",
          bgColor: "bg-indigo-50 border-indigo-200",
          href: "/tenant/onboarding/sign",
        });
      }
    }

    // Assurance manquante
    if (!dashboard.insurance?.has_insurance) {
      actions.push({
        id: "upload-insurance",
        label: "Déposer l'attestation d'assurance",
        description: "Obligatoire pour activer votre bail.",
        icon: Shield,
        color: "text-blue-700",
        bgColor: "bg-blue-50 border-blue-200",
        href: "/tenant/documents?action=upload&type=attestation_assurance",
      });
    }

    // EDL en attente
    if (dashboard.pending_edls && dashboard.pending_edls.length > 0) {
      actions.push({
        id: "sign-edl",
        label: "Signer l'état des lieux",
        description: "Un état des lieux est en attente de votre signature.",
        icon: FileCheck,
        color: "text-amber-700",
        bgColor: "bg-amber-50 border-amber-200",
        href: `/signature-edl/${dashboard.pending_edls[0].invitation_token}`,
      });
    }

    return actions;
  }, [dashboard]);

  // ── Documents clés (4 slots fixes) ──
  const keyDocuments = useMemo(() => {
    if (!documents.length) return { bail: null, quittance: null, edl: null, assurance: null };

    const sorted = [...documents].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

    let bail: any = null;
    let quittance: any = null;
    let edlEntree: any = null;
    let assurance: any = null;

    for (const doc of sorted) {
      const type = detectType(doc);
      if (!bail && (type === "bail" || type === "lease" || type === "contrat")) bail = doc;
      if (!quittance && (type === "quittance" || type === "receipt")) quittance = doc;
      if (!edlEntree && (type === "EDL_entree" || type === "edl_entree" || type === "edl")) edlEntree = doc;
      if (!assurance && (type === "attestation_assurance" || type === "assurance")) assurance = doc;
      if (bail && quittance && edlEntree && assurance) break;
    }

    return { bail, quittance, edl: edlEntree, assurance };
  }, [documents]);

  // ── Filtrage et tri des documents ──
  const filteredDocuments = useMemo(() => {
    // 1. Dédoublonnage
    const map = new Map();
    const sortedDocs = [...documents].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

    for (const doc of sortedDocs) {
      const type = detectType(doc);
      const key = `${type}-${doc.lease_id || doc.property_id || doc.id}`;
      const existing = map.get(key);
      if (!existing || (doc.metadata?.final && !existing.metadata?.final)) {
        map.set(key, doc);
      }
    }

    let result = Array.from(map.values());

    // 2. Filtre par recherche
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((doc: any) => {
        const type = detectType(doc);
        const config = DOCUMENT_CONFIG[type] ?? DOCUMENT_CONFIG.autre;
        return (doc.title || "").toLowerCase().includes(q) ||
          config.label.toLowerCase().includes(q) ||
          getDocumentTitle(doc, config).toLowerCase().includes(q);
      });
    }

    // 3. Filtre par type
    if (typeFilter !== "all") {
      result = result.filter((doc: any) => detectType(doc) === typeFilter);
    }

    // 4. Filtre par période (H-09)
    if (periodFilter !== "all") {
      const now = Date.now();
      const msMap: Record<string, number> = {
        "1m": 30 * 24 * 60 * 60 * 1000,
        "3m": 90 * 24 * 60 * 60 * 1000,
        "6m": 180 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
      };
      const ms = msMap[periodFilter];
      if (ms) {
        result = result.filter((doc: any) => now - new Date(doc.created_at).getTime() < ms);
      }
    }

    // 5. Tri (H-09)
    if (sortBy === "date_desc") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === "date_asc") {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "type") {
      result.sort((a, b) => detectType(a).localeCompare(detectType(b)));
    }

    return result;
  }, [documents, searchQuery, typeFilter, periodFilter, sortBy]);

  // ── Preview inline (H-04) ──
  const handlePreview = useCallback((doc: DocumentCardDoc) => {
    setPreviewUrl(`/api/documents/${doc.id}/download`);
    setPreviewTitle(getDocumentTitle(doc, DOCUMENT_CONFIG[detectType(doc)] ?? DOCUMENT_CONFIG.autre));
    setPreviewType(doc.metadata?.mime_type);
    setPreviewOpen(true);
  }, []);

  const handleDownload = useCallback((doc: DocumentCardDoc) => {
    const link = document.createElement("a");
    link.href = `/api/documents/${doc.id}/download`;
    link.download = getDocumentTitle(doc, DOCUMENT_CONFIG[detectType(doc)] ?? DOCUMENT_CONFIG.autre);
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter("all");
    setPeriodFilter("all");
    setSortBy("date_desc");
  }, []);

  // ──────────────────────────────────────────────
  // Rendu
  // ──────────────────────────────────────────────

  if (isLoading) return <DocumentsSkeleton />;

  // Erreur de chargement (H-13)
  if (error) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="p-4 bg-red-100 rounded-full">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Impossible de charger vos documents</h2>
            <p className="text-muted-foreground">Vérifiez votre connexion internet et réessayez.</p>
            <Button onClick={() => refetch()} className="mt-2">
              <RotateCcw className="h-4 w-4 mr-2" /> Réessayer
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PullToRefreshContainer>
        <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">

          {/* ═══════ HEADER ═══════ */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                  <FolderOpen className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes Documents</h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Bail, quittances, états des lieux, diagnostics — tout votre dossier au même endroit.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as "grid" | "cascade")}
                className="bg-background/80 rounded-lg border shadow-sm"
              >
                <TabsList className="grid grid-cols-2 h-11">
                  <TabsTrigger value="grid" className="flex items-center gap-1.5 text-xs px-3" aria-label="Vue grille">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grille
                  </TabsTrigger>
                  <TabsTrigger value="cascade" className="flex items-center gap-1.5 text-xs px-3" aria-label="Vue par catégorie">
                    <Layers className="h-3.5 w-3.5" />
                    Catégories
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <DocumentUploadModal leaseId={leaseId} propertyId={propertyId} />
            </div>
          </div>

          {/* ═══════ ZONE 1 : À FAIRE (H-03) ═══════ */}
          {pendingActions.length > 0 && (
            <div className="space-y-3" role="region" aria-label="Actions requises">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Actions requises ({pendingActions.length})
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {pendingActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <Link key={action.id} href={action.href}>
                      <GlassCard className={cn(
                        "flex items-center gap-4 p-4 border cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] motion-reduce:hover:scale-100",
                        action.bgColor,
                      )}>
                        <div className="p-2.5 bg-white/80 rounded-xl shrink-0 shadow-sm">
                          <ActionIcon className={cn("h-5 w-5", action.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-bold", action.color)}>{action.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                        </div>
                        <ArrowRight className={cn("h-4 w-4 shrink-0", action.color)} />
                      </GlassCard>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════ ZONE 2 : DOCUMENTS CLÉS ═══════ */}
          {hasLease && (
            <div className="space-y-3" role="region" aria-label="Documents essentiels">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Documents essentiels</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {/* Bail */}
                {keyDocuments.bail ? (
                  <DocumentCard
                    doc={keyDocuments.bail}
                    resolvedType={detectType(keyDocuments.bail)}
                    displayTitle={getDocumentTitle(keyDocuments.bail, DOCUMENT_CONFIG[detectType(keyDocuments.bail)] || DOCUMENT_CONFIG.autre)}
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    compact
                    isNew={isRecent(keyDocuments.bail)}
                  />
                ) : (
                  <GlassCard className="flex items-center gap-4 p-4 border-dashed border-2 border-border bg-muted/30">
                    <div className="p-2.5 rounded-xl bg-muted shrink-0">
                      <FileSignature className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Bail</p>
                      <p className="text-xs text-muted-foreground/70">Pas encore de bail</p>
                    </div>
                  </GlassCard>
                )}

                {/* Dernière quittance */}
                {keyDocuments.quittance ? (
                  <DocumentCard
                    doc={keyDocuments.quittance}
                    resolvedType={detectType(keyDocuments.quittance)}
                    displayTitle={getDocumentTitle(keyDocuments.quittance, DOCUMENT_CONFIG[detectType(keyDocuments.quittance)] || DOCUMENT_CONFIG.autre)}
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    compact
                    isNew={isRecent(keyDocuments.quittance)}
                  />
                ) : (
                  <GlassCard className="flex items-center gap-4 p-4 border-dashed border-2 border-border bg-muted/30">
                    <div className="p-2.5 rounded-xl bg-muted shrink-0">
                      <Receipt className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dernière quittance</p>
                      <p className="text-xs text-muted-foreground/70">Aucune quittance</p>
                    </div>
                  </GlassCard>
                )}

                {/* EDL d'entrée */}
                {keyDocuments.edl ? (
                  <DocumentCard
                    doc={keyDocuments.edl}
                    resolvedType={detectType(keyDocuments.edl)}
                    displayTitle={getDocumentTitle(keyDocuments.edl, DOCUMENT_CONFIG[detectType(keyDocuments.edl)] || DOCUMENT_CONFIG.autre)}
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    compact
                    isNew={isRecent(keyDocuments.edl)}
                  />
                ) : (
                  <GlassCard className="flex items-center gap-4 p-4 border-dashed border-2 border-border bg-muted/30">
                    <div className="p-2.5 rounded-xl bg-muted shrink-0">
                      <FileCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">État des lieux</p>
                      <p className="text-xs text-muted-foreground/70">Pas encore réalisé</p>
                    </div>
                  </GlassCard>
                )}

                {/* Assurance */}
                {keyDocuments.assurance ? (
                  <DocumentCard
                    doc={keyDocuments.assurance}
                    resolvedType={detectType(keyDocuments.assurance)}
                    displayTitle={getDocumentTitle(keyDocuments.assurance, DOCUMENT_CONFIG[detectType(keyDocuments.assurance)] || DOCUMENT_CONFIG.autre)}
                    onPreview={handlePreview}
                    onDownload={handleDownload}
                    compact
                    isNew={isRecent(keyDocuments.assurance)}
                  />
                ) : (
                  <GlassCard className="flex items-center gap-4 p-4 border-dashed border-2 border-border bg-muted/30">
                    <div className="p-2.5 rounded-xl bg-muted shrink-0">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Assurance</p>
                      <p className="text-xs text-muted-foreground/70">À déposer</p>
                    </div>
                  </GlassCard>
                )}
              </div>
            </div>
          )}

          {/* ═══════ ZONE 3 : TOUS LES DOCUMENTS ═══════ */}
          <div className="space-y-6" role="region" aria-label="Tous les documents">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Tous les documents</h2>

            {/* Barre de recherche et filtres enrichis (H-09) */}
            <GlassCard className="p-4 border-border bg-card/50 backdrop-blur-md sticky top-16 z-20 shadow-lg">
              <div className="flex flex-col gap-3">
                {/* Ligne 1 : Recherche */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un bail, une quittance, un diagnostic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-background/80 border-border h-11 focus:ring-2 focus:ring-indigo-500"
                    aria-label="Rechercher dans les documents"
                  />
                </div>
                {/* Ligne 2 : Filtres */}
                <div className="flex flex-wrap gap-2">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-44 h-10 bg-background/80 border-border text-sm">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Type" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="bail">Baux</SelectItem>
                      <SelectItem value="quittance">Quittances</SelectItem>
                      <SelectItem value="attestation_assurance">Assurance</SelectItem>
                      <SelectItem value="EDL_entree">EDL d'entrée</SelectItem>
                      <SelectItem value="EDL_sortie">EDL de sortie</SelectItem>
                      <SelectItem value="dpe">DPE</SelectItem>
                      <SelectItem value="erp">État des risques</SelectItem>
                      <SelectItem value="cni">Pièce d'identité</SelectItem>
                      <SelectItem value="justificatif_revenus">Justificatifs</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger className="w-full sm:w-44 h-10 bg-background/80 border-border text-sm">
                      <SelectValue placeholder="Période" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les dates</SelectItem>
                      <SelectItem value="1m">Dernier mois</SelectItem>
                      <SelectItem value="3m">3 derniers mois</SelectItem>
                      <SelectItem value="6m">6 derniers mois</SelectItem>
                      <SelectItem value="1y">Cette année</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-full sm:w-44 h-10 bg-background/80 border-border text-sm">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Tri" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Plus récent</SelectItem>
                      <SelectItem value="date_asc">Plus ancien</SelectItem>
                      <SelectItem value="type">Par type</SelectItem>
                    </SelectContent>
                  </Select>

                  {(searchQuery || typeFilter !== "all" || periodFilter !== "all") && (
                    <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" onClick={resetFilters}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Réinitialiser
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Résultats */}
            {filteredDocuments.length === 0 ? (
              // ── Empty states contextuels (H-13) ──
              <div className="py-20 text-center">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  {documents.length === 0 ? (
                    <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
                  ) : (
                    <Search className="h-10 w-10 text-muted-foreground/30" />
                  )}
                </div>
                {documents.length === 0 && !hasLease ? (
                  // Nouveau locataire sans bail
                  <>
                    <h3 className="text-xl font-bold text-foreground mb-2">Votre espace documents est vide</h3>
                    <p className="text-muted-foreground max-w-md mx-auto mb-6">
                      Vos documents apparaîtront ici dès que votre propriétaire les aura ajoutés ou que vous aurez lié votre logement.
                    </p>
                    <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
                      <Link href="/tenant/onboarding/context">
                        <Sparkles className="h-4 w-4 mr-2" /> Lier mon logement
                      </Link>
                    </Button>
                  </>
                ) : documents.length === 0 ? (
                  // Bail lié mais pas de documents
                  <>
                    <h3 className="text-xl font-bold text-foreground mb-2">Pas encore de documents</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Votre propriétaire n'a pas encore ajouté de documents. Ils apparaîtront ici automatiquement.
                    </p>
                  </>
                ) : (
                  // Filtres actifs mais aucun résultat
                  <>
                    <h3 className="text-xl font-bold text-foreground mb-2">Aucun document trouvé</h3>
                    <p className="text-muted-foreground mb-6">Modifiez vos filtres ou essayez une autre recherche.</p>
                    <Button variant="outline" onClick={resetFilters}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Réinitialiser les filtres
                    </Button>
                  </>
                )}
              </div>
            ) : viewMode === "cascade" ? (
              // ── Vue catégories ──
              <DocumentGroups
                documents={filteredDocuments.map((doc: any) => ({
                  id: doc.id,
                  type: detectType(doc),
                  title: getDocumentTitle(doc, DOCUMENT_CONFIG[detectType(doc)] || DOCUMENT_CONFIG.autre),
                  storage_path: doc.storage_path,
                  created_at: doc.created_at,
                  tenant_id: doc.tenant_id,
                  property_id: doc.property_id,
                  lease_id: doc.lease_id,
                  metadata: doc.metadata,
                  verification_status: doc.verification_status,
                }))}
                groupBy="category"
                onPreview={(doc) => {
                  setPreviewUrl(`/api/documents/${doc.id}/download`);
                  setPreviewTitle(doc.title || "Document");
                  setPreviewOpen(true);
                }}
                onDownload={(doc) => {
                  const link = document.createElement("a");
                  link.href = `/api/documents/${doc.id}/download`;
                  link.download = doc.title || "document";
                  link.target = "_blank";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              />
            ) : (
              // ── Vue grille ──
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((doc: any) => {
                  const type = detectType(doc);
                  const config = DOCUMENT_CONFIG[type] || DOCUMENT_CONFIG.autre;
                  return (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      resolvedType={type}
                      displayTitle={getDocumentTitle(doc, config)}
                      onPreview={handlePreview}
                      onDownload={handleDownload}
                      isNew={isRecent(doc)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Section sécurité */}
          <div className="mt-12 p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                  <Shield className="h-8 w-8 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold">Sécurité de vos données</h4>
                  <p className="text-white/60 text-sm max-w-md">
                    Tous vos documents sont chiffrés et stockés conformément aux normes RGPD. Seuls vous et votre bailleur y avez accès.
                  </p>
                </div>
              </div>
              <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md h-11 px-6">
                En savoir plus
              </Button>
            </div>
            <Sparkles className="absolute -right-4 -bottom-4 h-32 w-32 text-white/5 rotate-12" />
          </div>
        </div>
      </PullToRefreshContainer>

      {/* ── PDF Preview Modal (H-04) ── */}
      <PDFPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        documentUrl={previewUrl}
        documentTitle={previewTitle}
        documentType={previewType}
      />
    </PageTransition>
  );
}

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

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useDocumentCenter } from "@/lib/hooks/use-document-center";
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
  Shield,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowUpDown,
  RotateCcw,
  FileSignature,
  Receipt,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentGroups } from "@/components/documents/document-groups";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { useTenantData } from "../_data/TenantDataProvider";
import { useAuth } from "@/lib/hooks/use-auth";
import { PDFPreviewModal } from "@/components/documents/pdf-preview-modal";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { DocumentCard, DOCUMENT_CONFIG, type DocumentCardDoc } from "@/components/documents/DocumentCard";
import { TENANT_FILTER_TYPES } from "@/lib/documents/document-config";
import { getDocumentDisplayName } from "@/lib/documents/format-name";
import { groupDocuments } from "@/lib/documents/group-documents";
import { GroupedDocumentCard } from "@/features/documents/components/grouped-document-card";
import Link from "next/link";
import { useTenantPendingActions } from "@/lib/hooks/use-tenant-pending-actions";
import { useTenantInspections } from "@/lib/hooks/queries/use-tenant-inspections";

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

  // AUDIT UX: Identité détectée en priorité pour éviter qu'une CNI soit classée comme "bail"
  if (searchText.includes("cni") || searchText.includes("identité") || searchText.includes("identite") || searchText.includes("passeport") || searchText.includes("carte d'identité") || searchText.includes("carte d'identite") || searchText.includes("carte_identite") || searchText.includes("carte nationale")) return "cni";
  if (searchText.includes("quittance") || (searchText.includes("loyer") && !searchText.includes("attestation"))) return "quittance";
  if (searchText.includes("remise des clés") || searchText.includes("remise des cles") || searchText.includes("attestation_remise_cles")) return "attestation_remise_cles";
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
  if (searchText.includes("fiche de paie") || searchText.includes("bulletin") || searchText.includes("revenu")) return "justificatif_revenus";
  if (searchText.includes("facture") || searchText.includes("invoice")) return "facture";

  return type || "autre";
}

/** Parse une date de manière sûre — retourne 0 si invalide */
function safeTime(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Formate une date de manière sûre — retourne "Date inconnue" si invalide */
function formatSafeDate(dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return "Date inconnue";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date inconnue";
  return d.toLocaleDateString("fr-FR", options || { day: "numeric", month: "short", year: "numeric" });
}


/** Vérifie si un document date de moins de 7 jours */
function isRecent(doc: any): boolean {
  const t = safeTime(doc.created_at);
  if (t === 0) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
}

/** Détermine la source d'un document pour le locataire */
function getDocumentSource(doc: any, profileId: string): "self" | "shared" {
  // Si uploaded_by correspond au profil courant → document uploadé par le locataire
  if (doc.uploaded_by === profileId) return "self";
  // Si uploaded_by est renseigné et différent → partagé par le propriétaire
  if (doc.uploaded_by && doc.uploaded_by !== profileId) return "shared";
  // Fallback: les types typiquement déposés par le locataire
  if (doc.tenant_id === profileId) {
    const selfTypes = [
      "attestation_assurance", "cni_recto", "cni_verso", "piece_identite",
      "passeport", "justificatif_revenus", "avis_imposition", "bulletin_paie",
      "rib", "titre_sejour", "cni",
    ];
    const type = detectType(doc);
    if (selfTypes.includes(type)) return "self";
  }
  return "shared";
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
  // SOTA 2026: Utiliser useDocumentCenter (RPC optimisée) avec fallback useDocuments
  const documentCenter = useDocumentCenter();
  const legacyDocs = useDocuments();

  // Si la RPC retourne des documents, on les utilise. Sinon fallback sur le hook legacy.
  const hasCenterData = (documentCenter.data?.documents?.length ?? 0) > 0;
  const documents = hasCenterData ? (documentCenter.data?.documents ?? []) : (legacyDocs.data ?? []);
  const isLoading = documentCenter.isLoading || (!hasCenterData && legacyDocs.isLoading);
  const error = hasCenterData ? documentCenter.error : legacyDocs.error;
  const refetch = hasCenterData ? documentCenter.refetch : legacyDocs.refetch;

  const { dashboard } = useTenantData();
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // SOTA 2026: Support ?type=quittance pour le redirect depuis /tenant/receipts
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam) {
      setTypeFilter(typeParam);
    }
  }, [searchParams]);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
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

  // ── Actions requises (zone "À faire") — source unique via hook partagé ──
  const hasSignedLease = useMemo(() => {
    const signers = (dashboard?.lease as any)?.lease_signers || (dashboard?.lease as any)?.signers || [];
    const tenantSigner = (signers as any[]).find(
      (s: any) => s.role === "locataire_principal" || s.role === "tenant" || s.role === "locataire"
    );
    return tenantSigner?.signature_status === "signed" || !!tenantSigner?.signed_at;
  }, [dashboard]);

  const pendingEDLs = useMemo(() => dashboard?.pending_edls || [], [dashboard]);

  // Fetch EDL data from the `edl` table — Documents Essentiels needs this because
  // EDLs are stored in a separate table and may not exist in the `documents` table.
  const { data: edlList = [] } = useTenantInspections();

  const pendingActions = useTenantPendingActions({
    dashboard,
    hasSignedLease,
    pendingEDLs,
  });

  // ── Documents clés (4 slots fixes) ──
  // Ensembles de types (lowercase) — alignés avec la vue SQL v_tenant_key_documents
  // et le CHECK CONSTRAINT documents.type (qui stocke "EDL_entree" en capitales).
  const BAIL_TYPES = useMemo(() => new Set([
    "bail", "contrat_bail", "contrat", "lease",
    "avenant", "bail_signe", "bail_signe_locataire", "bail_signe_proprietaire",
  ]), []);
  const QUITTANCE_TYPES = useMemo(() => new Set([
    "quittance", "quittance_loyer", "receipt",
  ]), []);
  const EDL_TYPES = useMemo(() => new Set([
    "edl_entree", "edl_sortie", "edl", "inventaire",
    "etat_des_lieux", "etat_lieux",
  ]), []);
  const ASSURANCE_TYPES = useMemo(() => new Set([
    "attestation_assurance", "assurance", "assurance_pno", "assurance_habitation",
  ]), []);

  const keyDocuments = useMemo(() => {
    if (!documents.length) return { bail: null, quittance: null, edl: null, assurance: null };

    // Bug 2 : ne pas considérer les documents sans type valide / "autre" pour
    // les slots des documents essentiels. Sinon une capture d'écran uploadée
    // sans type apparaît dans la grille des 4 cards essentielles.
    const eligible = documents.filter((d: any) => {
      const rawType = (d.type ?? "").toString().toLowerCase().trim();
      const detected = (detectType(d) ?? "").toString().toLowerCase().trim();
      if (!rawType && !detected) return false;
      if (rawType === "autre" && detected === "autre") return false;
      return true;
    });

    const sorted = [...eligible].sort((a, b) => safeTime(b.created_at) - safeTime(a.created_at));

    let bail: any = null;
    let quittance: any = null;
    let edlEntree: any = null;
    let assurance: any = null;

    for (const doc of sorted) {
      // Comparaison case-insensitive : les DB historiques mélangent "EDL_entree" et "edl_entree".
      const rawType = (doc.type ?? "").toString().toLowerCase();
      const detected = (detectType(doc) ?? "").toLowerCase();
      const matches = (set: Set<string>) => set.has(rawType) || set.has(detected);

      if (!bail && matches(BAIL_TYPES)) bail = doc;
      if (!quittance && matches(QUITTANCE_TYPES)) quittance = doc;
      if (!edlEntree && matches(EDL_TYPES)) edlEntree = doc;
      if (!assurance && matches(ASSURANCE_TYPES)) assurance = doc;
      if (bail && quittance && edlEntree && assurance) break;
    }

    // Fallback: if no EDL found in documents table, use the edl table data.
    // EDLs are stored in a separate `edl` table and may not have a matching
    // row in `documents`. We synthesize a virtual document for the card.
    if (!edlEntree && edlList.length > 0) {
      // Pick the most relevant EDL: prefer signed entree, then any entree, then any EDL
      const signedEntree = edlList.find(e => e.type === "entree" && e.isSigned);
      const anyEntree = edlList.find(e => e.type === "entree");
      const bestEdl = signedEntree || anyEntree || edlList[0];
      if (bestEdl) {
        edlEntree = {
          id: bestEdl.id,
          type: bestEdl.type === "entree" ? "EDL_entree" : "EDL_sortie",
          title: `État des lieux ${bestEdl.type === "entree" ? "d'entrée" : "de sortie"}`,
          storage_path: null,
          created_at: bestEdl.scheduled_at || bestEdl.created_at,
          property_id: bestEdl.property?.id || null,
          metadata: {},
          // Flag for the card to know this is from the edl table
          _fromEdlTable: true,
          _edlId: bestEdl.id,
          _edlStatus: bestEdl.status,
          _edlIsSigned: bestEdl.isSigned,
        };
      }
    }

    return { bail, quittance, edl: edlEntree, assurance };
  }, [documents, edlList, BAIL_TYPES, QUITTANCE_TYPES, EDL_TYPES, ASSURANCE_TYPES]);

  // ── Filtrage et tri des documents ──
  const filteredDocuments = useMemo(() => {
    // 1. Dédoublonnage
    const map = new Map();
    const sortedDocs = [...documents].sort((a, b) => safeTime(b.created_at) - safeTime(a.created_at));

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
          getDocumentDisplayName(doc).toLowerCase().includes(q);
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
        result = result.filter((doc: any) => now - safeTime(doc.created_at) < ms);
      }
    }

    // 5. Filtre par source (inter-compte)
    if (sourceFilter !== "all" && profile?.id) {
      result = result.filter((doc: any) => {
        const source = getDocumentSource(doc, profile.id);
        return sourceFilter === "self" ? source === "self" : source === "shared";
      });
    }

    // 6. Tri (H-09)
    if (sortBy === "date_desc") {
      result.sort((a, b) => safeTime(b.created_at) - safeTime(a.created_at));
    } else if (sortBy === "date_asc") {
      result.sort((a, b) => safeTime(a.created_at) - safeTime(b.created_at));
    } else if (sortBy === "type") {
      result.sort((a, b) => detectType(a).localeCompare(detectType(b)));
    }

    return result;
  }, [documents, searchQuery, typeFilter, sourceFilter, periodFilter, sortBy, profile?.id]);

  // Groupement CNI recto/verso pour la vue grille
  const displayDocs = useMemo(() => groupDocuments(filteredDocuments as any[]), [filteredDocuments]);

  const fetchSignedUrlData = useCallback(async (docId: string): Promise<{ signedUrl: string; mimeType?: string; storagePath?: string } | null> => {
    try {
      const res = await fetch(`/api/documents/${docId}/signed-url`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.signedUrl ? { signedUrl: data.signedUrl, mimeType: data.mimeType, storagePath: data.storagePath } : null;
    } catch {
      return null;
    }
  }, []);

  // ── Preview inline (H-04) ──
  const handlePreview = useCallback(async (doc: DocumentCardDoc) => {
    setPreviewTitle(getDocumentDisplayName(doc));
    setPreviewUrl(null);
    setPreviewOpen(true);

    const data = await fetchSignedUrlData(doc.id);
    if (data) {
      setPreviewType(data.mimeType || doc.metadata?.mime_type);
      setPreviewUrl(data.signedUrl);
    }
  }, [fetchSignedUrlData]);

  const handleDownload = useCallback(async (doc: DocumentCardDoc) => {
    const data = await fetchSignedUrlData(doc.id);
    if (!data) return;

    const title = getDocumentDisplayName(doc);
    const isHtml = data.mimeType === "text/html" || data.storagePath?.endsWith(".html");

    if (isHtml) {
      // Convertir HTML → PDF avant téléchargement
      try {
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("Erreur chargement");
        const htmlText = await response.text();

        const html2pdf = (await import("html2pdf.js")).default;
        const container = document.createElement("div");
        container.innerHTML = htmlText;
        container.style.position = "absolute";
        container.style.left = "-9999px";
        container.style.top = "0";
        document.body.appendChild(container);

        const filename = title.replace(/\.html?$/i, "") + ".pdf";
        await html2pdf()
          .set({
            margin: 10,
            filename,
            image: { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
            pagebreak: { mode: ["avoid-all", "css", "legacy"] },
          })
          .from(container)
          .save();

        document.body.removeChild(container);
      } catch (err) {
        console.error("Erreur conversion HTML→PDF:", err);
        // Fallback: ouvrir dans un nouvel onglet
        window.open(data.signedUrl, "_blank");
      }
    } else {
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = title;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [fetchSignedUrlData]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setTypeFilter("all");
    setSourceFilter("all");
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
                        <div className="p-2.5 bg-card/80 rounded-xl shrink-0 shadow-sm">
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
                    displayTitle={getDocumentDisplayName(keyDocuments.bail)}
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
                    displayTitle={getDocumentDisplayName(keyDocuments.quittance)}
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
                  keyDocuments.edl._fromEdlTable ? (
                    // EDL from the `edl` table — link to detail page
                    <Link href={`/tenant/inspections/${keyDocuments.edl._edlId}`}>
                      <GlassCard className="flex items-center gap-4 p-4 border border-emerald-200 bg-emerald-50/30 hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
                        <div className="p-2.5 rounded-xl bg-emerald-100 shrink-0">
                          <FileCheck className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{keyDocuments.edl.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {keyDocuments.edl._edlIsSigned ? "Signé" : keyDocuments.edl._edlStatus === "in_progress" ? "En cours" : keyDocuments.edl._edlStatus}
                            {" — "}
                            {formatSafeDate(keyDocuments.edl.created_at)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-emerald-600 shrink-0" />
                      </GlassCard>
                    </Link>
                  ) : (
                    <DocumentCard
                      doc={keyDocuments.edl}
                      resolvedType={detectType(keyDocuments.edl)}
                      displayTitle={getDocumentDisplayName(keyDocuments.edl)}
                      onPreview={handlePreview}
                      onDownload={handleDownload}
                      compact
                      isNew={isRecent(keyDocuments.edl)}
                    />
                  )
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
                    displayTitle={getDocumentDisplayName(keyDocuments.assurance)}
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
                      {TENANT_FILTER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-full sm:w-44 h-10 bg-background/80 border-border text-sm">
                      <div className="flex items-center gap-2">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Source" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les sources</SelectItem>
                      <SelectItem value="self">Mes documents</SelectItem>
                      <SelectItem value="shared">Du propriétaire</SelectItem>
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

                  {(searchQuery || typeFilter !== "all" || sourceFilter !== "all" || periodFilter !== "all") && (
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
                  title: getDocumentDisplayName(doc),
                  storage_path: doc.storage_path,
                  created_at: doc.created_at,
                  tenant_id: doc.tenant_id,
                  property_id: doc.property_id,
                  lease_id: doc.lease_id,
                  metadata: doc.metadata,
                  verification_status: doc.verification_status,
                }))}
                groupBy="category"
                onPreview={async (doc) => {
                  setPreviewTitle(doc.title || "Document");
                  setPreviewUrl(null);
                  setPreviewOpen(true);
                  const data = await fetchSignedUrlData(doc.id);
                  if (data?.signedUrl) setPreviewUrl(data.signedUrl);
                }}
                onDownload={async (doc) => {
                  const data = await fetchSignedUrlData(doc.id);
                  if (!data?.signedUrl) return;
                  const link = document.createElement("a");
                  link.href = data.signedUrl;
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
                {displayDocs.map((doc: any) => {
                  if (doc.kind === "group") {
                    return (
                      <GroupedDocumentCard
                        key={doc.key}
                        item={doc}
                      />
                    );
                  }
                  const type = detectType(doc);
                  const config = DOCUMENT_CONFIG[type] || DOCUMENT_CONFIG.autre;
                  const source = profile?.id ? getDocumentSource(doc, profile.id) : undefined;
                  const isCrossAccountNew = source === "shared" && isRecent(doc);
                  return (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      resolvedType={type}
                      displayTitle={getDocumentDisplayName(doc)}
                      onPreview={handlePreview}
                      onDownload={handleDownload}
                      isNew={isCrossAccountNew || isRecent(doc)}
                      sourceLabel={source === "shared" ? "Du propriétaire" : undefined}
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
                <div className="p-3 bg-card/10 rounded-2xl backdrop-blur-md">
                  <Shield className="h-8 w-8 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold">Sécurité de vos données</h4>
                  <p className="text-white/60 text-sm max-w-md">
                    Tous vos documents sont chiffrés et stockés conformément aux normes RGPD. Seuls vous et votre bailleur y avez accès.
                  </p>
                </div>
              </div>
              <Button variant="secondary" className="bg-card/10 hover:bg-card/20 text-white border-white/20 backdrop-blur-md h-11 px-6" asChild>
                <Link href="/tenant/help">En savoir plus</Link>
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

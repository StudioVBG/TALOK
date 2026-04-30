"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ArrowLeft,
  Plus,
  MapPin,
  Layers,
  Home,
  MoreHorizontal,
  Users,
  Euro,
  TrendingUp,
  Filter,
  FileText,
  Pencil,
  X,
  Upload,
  AlertCircle,
  Clock,
  CheckCircle2,
  FolderOpen,
  Wrench,
  Eye,
  Trash2,
  Sparkles,
  Copy,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { LotCharacteristicsDrawer } from "./LotCharacteristicsDrawer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiClient } from "@/lib/api-client";
import type { BuildingRow, BuildingUnitRow } from "@/lib/supabase/database.types";
import type { DeleteGuardResult } from "@/lib/properties/guards";
import { TYPE_TO_LABEL, type DocumentType } from "@/lib/documents/constants";
import { SmartImageCard } from "@/components/ui/smart-image-card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LotPropertyRef {
  id: string;
  cover_url: string | null;
  unique_code: string | null;
  adresse_complete: string | null;
}

interface UnitLease {
  id: string;
  tenant_id: string | null;
  date_fin: string | null;
  statut: string | null;
  loyer: number | null;
  charges_forfaitaires: number | null;
}

interface UnitTenant {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface BuildingDetailClientProps {
  propertyId: string;
  buildingId: string | null;
  building: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    departement: string;
    surface: number;
    cover_url: string | null;
    annee_construction: number | null;
    created_at: string;
    updated_at: string;
  };
  buildingMeta: Partial<BuildingRow> | null;
  units: Array<Partial<BuildingUnitRow> & { property_id?: string | null }>;
  lotProperties?: LotPropertyRef[];
  leases?: UnitLease[];
  tenants?: UnitTenant[];
  documents?: BuildingDocument[];
}

interface BuildingDocument {
  id: string;
  type: string;
  title: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  expiry_date?: string | null;
  valid_until?: string | null;
  ged_status?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const unitTypeLabels: Record<string, string> = {
  appartement: "Appartement",
  studio: "Studio",
  local_commercial: "Local commercial",
  parking: "Parking",
  cave: "Cave",
  bureau: "Bureau",
};

/** Palette utilisée par le Badge <status> de SmartImageCard — aligné avec /owner/properties */
const statusStyles: Record<string, string> = {
  vacant: "bg-red-500/90 text-white border-red-600",
  occupe: "bg-emerald-500/90 text-white border-emerald-600",
  travaux: "bg-amber-500/90 text-white border-amber-600",
  reserve: "bg-indigo-500/90 text-white border-indigo-600",
};

const statusLabels: Record<string, string> = {
  vacant: "Vacant",
  occupe: "Occupé",
  travaux: "Travaux",
  reserve: "Réservé",
};

/** Document types relevant for buildings */
const BUILDING_DOCUMENT_TYPES: { type: DocumentType; label: string; hasExpiry: boolean }[] = [
  { type: "assurance_pno", label: "Assurance PNO", hasExpiry: true },
  { type: "diagnostic_amiante", label: "Diagnostic amiante", hasExpiry: true },
  { type: "diagnostic_plomb", label: "Diagnostic plomb (parties communes)", hasExpiry: true },
  { type: "copropriete", label: "Règlement de copropriété", hasExpiry: false },
  { type: "proces_verbal", label: "PV d'assemblée générale", hasExpiry: false },
  { type: "diagnostic", label: "Carnet d'entretien", hasExpiry: false },
  { type: "erp", label: "État des risques (ERP)", hasExpiry: true },
  { type: "dpe", label: "DPE", hasExpiry: true },
  { type: "photo", label: "Plan de l'immeuble", hasExpiry: false },
  { type: "autre", label: "Autre document", hasExpiry: false },
];

function floorLabel(floor: number): string {
  if (floor < 0) return `Sous-sol ${Math.abs(floor)}`;
  if (floor === 0) return "Rez-de-chaussée";
  return `Étage ${floor}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getExpiryStatus(date: string | null | undefined): "ok" | "expiring" | "expired" | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 30) return "expiring";
  return "ok";
}

// ─── Editable Field Component ─────────────────────────────────────────────────

function EditableField({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          onBlur={commit}
          className={`h-8 text-sm ${className ?? ""}`}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`group inline-flex items-center gap-1.5 hover:text-[#2563EB] transition-colors text-left ${className ?? ""}`}
    >
      <span>{value}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ─── Equipment Toggle Row ─────────────────────────────────────────────────────

function EquipmentToggle({
  label,
  checked,
  onToggle,
  saving,
}: {
  label: string;
  checked: boolean;
  onToggle: (val: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="text-sm font-normal cursor-pointer">{label}</Label>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        disabled={saving}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BuildingDetailClient({
  propertyId,
  buildingId,
  building,
  buildingMeta,
  units,
  lotProperties = [],
  leases = [],
  tenants = [],
  documents: initialDocuments,
}: BuildingDetailClientProps) {
  const { toast } = useToast();

  // Index lot properties / leases / tenants by id for O(1) lookup in the lot cards
  const lotPropertyById = useMemo(() => {
    const m = new Map<string, LotPropertyRef>();
    for (const lp of lotProperties) m.set(lp.id, lp);
    return m;
  }, [lotProperties]);

  const leaseById = useMemo(() => {
    const m = new Map<string, UnitLease>();
    for (const l of leases) m.set(l.id, l);
    return m;
  }, [leases]);

  const tenantById = useMemo(() => {
    const m = new Map<string, UnitTenant>();
    for (const t of tenants) m.set(t.id, t);
    return m;
  }, [tenants]);

  // ── Inline editing state ──
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState({
    has_ascenseur: buildingMeta?.has_ascenseur ?? false,
    has_gardien: buildingMeta?.has_gardien ?? false,
    has_interphone: buildingMeta?.has_interphone ?? false,
    has_digicode: buildingMeta?.has_digicode ?? false,
    has_local_velo: buildingMeta?.has_local_velo ?? false,
    has_local_poubelles: buildingMeta?.has_local_poubelles ?? false,
    has_parking_commun: (buildingMeta as any)?.has_parking_commun ?? false,
    has_jardin_commun: (buildingMeta as any)?.has_jardin_commun ?? false,
  });

  // Détails immeuble (name, construction_year, surface_totale, notes)
  const [buildingName, setBuildingName] = useState<string>(
    (buildingMeta as any)?.name ?? ""
  );
  const [constructionYear, setConstructionYear] = useState<number | "">(
    (buildingMeta as any)?.construction_year ?? ""
  );
  const [surfaceTotale, setSurfaceTotale] = useState<number | "">(
    (buildingMeta as any)?.surface_totale ?? ""
  );
  const [buildingNotes, setBuildingNotes] = useState<string>(
    (buildingMeta as any)?.notes ?? ""
  );

  // Mode de possession
  const [ownershipType, setOwnershipType] = useState<"full" | "partial">(
    ((buildingMeta as any)?.ownership_type as "full" | "partial") ?? "full"
  );
  const [totalLotsInBuilding, setTotalLotsInBuilding] = useState<number | "">(
    (buildingMeta as any)?.total_lots_in_building ?? ""
  );

  // Drawer caractéristiques lot (item #5)
  const [drawerLot, setDrawerLot] = useState<{
    propertyId: string;
    label: string;
  } | null>(null);

  // Dialog duplication lot (item #25)
  const [duplicateSource, setDuplicateSource] = useState<{
    unitId: string;
    sourceFloor: number;
  } | null>(null);
  const [duplicateTargetFloors, setDuplicateTargetFloors] = useState<number[]>([]);
  const [duplicating, setDuplicating] = useState(false);

  // Stats officielles via /api/buildings/[id]/stats (item #15)
  const [serverStats, setServerStats] = useState<{
    occupancy_rate: number | null;
    revenus_actuels: number | null;
    revenus_potentiels: number | null;
    occupied_units: number | null;
    total_units: number | null;
  } | null>(null);

  // ── Documents state ──
  const [documents, setDocuments] = useState<BuildingDocument[]>(initialDocuments || []);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("assurance_pno");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Delete building ──
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteGuard, setDeleteGuard] = useState<DeleteGuardResult | null>(null);
  const [deleteGuardLoading, setDeleteGuardLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleOpenDeleteDialog = useCallback(async () => {
    setDeleteDialogOpen(true);
    setDeleteGuard(null);
    setDeleteGuardLoading(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/can-delete`);
      if (!res.ok) throw new Error("Erreur lors de la vérification");
      const data: DeleteGuardResult = await res.json();
      setDeleteGuard(data);
    } catch {
      setDeleteGuard({
        canDelete: false,
        canArchive: false,
        blockers: ["Impossible de vérifier les dépendances. Réessayez."],
        warnings: [],
        linkedData: { activeLeases: 0, terminatedLeases: 0, documents: 0, tickets: 0, photos: 0 },
      });
    } finally {
      setDeleteGuardLoading(false);
    }
  }, [propertyId]);

  const handleDeleteBuilding = useCallback(async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/properties/${propertyId}`);
      toast({ title: "Immeuble supprimé avec succès" });
      router.push("/owner/properties?tab=immeubles");
    } catch (e) {
      const msg = (e as Error)?.message || "Erreur lors de la suppression";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }, [propertyId, toast, router]);

  // ── Cover photo ──
  const [coverUrl, setCoverUrl] = useState<string | null>(building.cover_url);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Seules les images sont acceptées", variant: "destructive" });
      return;
    }
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "photo");
      formData.append("property_id", propertyId);

      // apiClient.uploadFile : CSRF + cookies + check response.ok intégrés
      const result = await apiClient.uploadFile<any>("/documents/upload", formData);
      const doc = result.document || result;

      // Get signed URL for the uploaded photo to use as cover
      const urlRes = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (urlRes.ok) {
        const urlData = await urlRes.json();
        const newCoverUrl = urlData.signedUrl || urlData.url;
        setCoverUrl(newCoverUrl);
        // NOTE: la cover persistante est dérivée côté serveur depuis la table `photos`
        // (ou `documents` collection=property_media is_cover=true). Aucune colonne
        // `cover_url` n'existe sur `properties` — l'ancien PATCH ici échouait
        // silencieusement.
      }

      toast({ title: "Photo mise à jour" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Erreur", variant: "destructive" });
    } finally {
      setUploadingCover(false);
    }
  }, [propertyId, toast]);

  // ── Filters ──
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ── PATCH helper ──
  const patchBuilding = useCallback(async (data: Record<string, unknown>) => {
    if (!buildingId) {
      toast({ title: "Immeuble non configuré", variant: "destructive" });
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/buildings/${buildingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur lors de la sauvegarde");
      }
      toast({ title: "Modifications enregistrées" });
      return true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Erreur", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }, [buildingId, toast]);

  const handleEquipmentToggle = useCallback(async (key: keyof typeof equipment, val: boolean) => {
    setEquipment(prev => ({ ...prev, [key]: val }));
    const ok = await patchBuilding({ [key]: val });
    if (!ok) setEquipment(prev => ({ ...prev, [key]: !val }));
  }, [patchBuilding]);

  // Fetch server stats (building_stats view) — fallback silencieux sur calcul inline
  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    fetch(`/api/buildings/${buildingId}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const s = data.stats || data;
        if (s && typeof s === "object") {
          setServerStats({
            occupancy_rate:
              typeof s.occupancy_rate === "number" ? s.occupancy_rate : null,
            revenus_actuels:
              typeof s.revenus_actuels === "number" ? s.revenus_actuels : null,
            revenus_potentiels:
              typeof s.revenus_potentiels === "number" ? s.revenus_potentiels : null,
            occupied_units:
              typeof s.occupied_units === "number" ? s.occupied_units : null,
            total_units:
              typeof s.total_units === "number" ? s.total_units : null,
          });
        }
      })
      .catch(() => {
        /* silencieux — fallback sur calcul inline */
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  // Duplication lot (item #25)
  const handleDuplicateSubmit = useCallback(async () => {
    if (!buildingId || !duplicateSource) return;
    if (duplicateTargetFloors.length === 0) return;
    setDuplicating(true);
    try {
      const res = await fetch(
        `/api/buildings/${buildingId}/units/${duplicateSource.unitId}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_floors: duplicateTargetFloors }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur duplication");
      }
      const data = await res.json();
      toast({
        title: `${data.count ?? duplicateTargetFloors.length} lot(s) créé(s)`,
        description: "Rechargement…",
      });
      // Rafraîchir pour charger les nouveaux lots
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 600);
      setDuplicateSource(null);
      setDuplicateTargetFloors([]);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Erreur",
        variant: "destructive",
      });
    } finally {
      setDuplicating(false);
    }
  }, [buildingId, duplicateSource, duplicateTargetFloors, toast]);

  // ── Unit actions ──
  const [unitStatuses, setUnitStatuses] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const u of units) if (u.id && u.status) m[u.id] = u.status;
    return m;
  });
  const [deletedUnitIds, setDeletedUnitIds] = useState<Set<string>>(new Set());

  const handleUnitStatusChange = useCallback(async (unitId: string, newStatus: string) => {
    if (!buildingId) return;
    const prev = unitStatuses[unitId];
    setUnitStatuses(s => ({ ...s, [unitId]: newStatus }));
    try {
      const res = await fetch(`/api/buildings/${buildingId}/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast({ title: `Lot marqué ${statusLabels[newStatus] || newStatus}` });
    } catch {
      setUnitStatuses(s => ({ ...s, [unitId]: prev }));
      toast({ title: "Erreur de mise à jour", variant: "destructive" });
    }
  }, [buildingId, unitStatuses, toast]);

  const handleUnitDelete = useCallback(async (unitId: string) => {
    if (!buildingId) return;
    try {
      const res = await fetch(`/api/buildings/${buildingId}/units/${unitId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur de suppression");
      }
      setDeletedUnitIds(prev => new Set(prev).add(unitId));
      toast({ title: "Lot supprimé" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Erreur", variant: "destructive" });
    }
  }, [buildingId, toast]);

  // ── Document upload ──
  const handleDocUpload = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", selectedDocType);
      formData.append("property_id", propertyId);

      // apiClient.uploadFile : CSRF + cookies + check response.ok intégrés
      const result = await apiClient.uploadFile<any>("/documents/upload", formData);
      if (result.document) {
        setDocuments(prev => [result.document, ...prev]);
      }
      toast({ title: "Document ajouté" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Erreur d'upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [propertyId, selectedDocType, toast]);

  // ── Computed ──
  const availableFloors = useMemo(() => {
    return [...new Set(units.map((u) => u.floor ?? 0))].sort((a, b) => b - a);
  }, [units]);

  const availableTypes = useMemo(() => {
    return [...new Set(units.map((u) => u.type || "appartement"))];
  }, [units]);

  // Live units with optimistic status updates and deletions
  const liveUnits = useMemo(() => {
    return units
      .filter(u => u.id && !deletedUnitIds.has(u.id))
      .map(u => ({ ...u, status: unitStatuses[u.id!] || u.status }));
  }, [units, unitStatuses, deletedUnitIds]);

  const filteredUnits = useMemo(() => {
    return liveUnits.filter((u) => {
      if (filterFloor !== "all" && (u.floor ?? 0) !== Number(filterFloor)) return false;
      if (filterType !== "all" && u.type !== filterType) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      return true;
    });
  }, [liveUnits, filterFloor, filterType, filterStatus]);

  const unitsByFloor = filteredUnits.reduce<Record<number, typeof filteredUnits>>((acc, unit) => {
    const floor = unit.floor ?? 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {});

  const floors = Object.keys(unitsByFloor).map(Number).sort((a, b) => b - a);

  const totalUnits = liveUnits.length;
  const parkingUnits = liveUnits.filter((u) => u.type === "parking" || u.type === "cave").length;
  const habitableUnits = totalUnits - parkingUnits;
  const vacantUnits = liveUnits.filter((u) => u.status === "vacant" && u.type !== "parking" && u.type !== "cave").length;
  const occupiedUnitsInline = liveUnits.filter((u) => u.status === "occupe" && u.type !== "parking" && u.type !== "cave").length;
  const revenuActuelInline = liveUnits.filter((u) => u.status === "occupe").reduce((sum, u) => sum + (u.loyer_hc || 0) + (u.charges || 0), 0);
  const revenuPotentielInline = liveUnits.reduce((sum, u) => sum + (u.loyer_hc || 0) + (u.charges || 0), 0);

  // Stats finales : priorité à serverStats (vue building_stats) sinon calcul inline
  const occupiedUnits = serverStats?.occupied_units ?? occupiedUnitsInline;
  const occupancyRate =
    serverStats?.occupancy_rate ??
    (habitableUnits > 0 ? Math.round((occupiedUnitsInline / habitableUnits) * 100) : 0);
  const revenuActuel = serverStats?.revenus_actuels ?? revenuActuelInline;
  const revenuPotentiel = serverStats?.revenus_potentiels ?? revenuPotentielInline;

  const hasActiveFilters = filterFloor !== "all" || filterType !== "all" || filterStatus !== "all";

  // Liste des étages possibles pour la duplication (tous sauf celui du lot source)
  const duplicateCandidateFloors = useMemo(() => {
    const floorsCount = buildingMeta?.floors ?? 1;
    const all = Array.from({ length: floorsCount }, (_, i) => i);
    if (duplicateSource) return all.filter((f) => f !== duplicateSource.sourceFloor);
    return all;
  }, [buildingMeta, duplicateSource]);

  // Group documents by type
  const documentsByType = useMemo(() => {
    const map = new Map<string, BuildingDocument[]>();
    for (const doc of documents) {
      const existing = map.get(doc.type) || [];
      existing.push(doc);
      map.set(doc.type, existing);
    }
    return map;
  }, [documents]);

  // ── Render ──
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Breadcrumb : Mes biens > Immeuble "…" */}
      <Breadcrumb
        showHome={false}
        className="mb-4"
        items={[
          { label: "Mes biens", href: "/owner/properties?tab=immeubles" },
          { label: `Immeuble ${building.adresse_complete}` },
        ]}
      />

      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/owner/properties?tab=immeubles">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux immeubles
        </Link>
      </Button>

      {/* Header */}
      <div className="relative h-56 md:h-64 rounded-xl overflow-hidden mb-8 bg-card group">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={building.adresse_complete}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1D4ED8] to-[#60A5FA]">
            <Building2 className="h-24 w-24 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        {/* Cover photo button + delete button */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm"
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
          >
            {uploadingCover ? (
              <><span className="h-3.5 w-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Envoi...</>
            ) : (
              <><Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier la photo</>
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="bg-red-600/80 hover:bg-red-700 text-white border-0 backdrop-blur-sm"
            onClick={handleOpenDeleteDialog}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Supprimer
          </Button>
          <input
            ref={coverInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ""; }}
          />
        </div>
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold font-[family-name:var(--font-manrope)]">
              <EditableField
                value={buildingName || building.adresse_complete}
                onSave={(val) => {
                  setBuildingName(val);
                  void patchBuilding({ name: val });
                }}
                className="text-white"
              />
            </h1>
            <Badge className="bg-[#2563EB] text-white shrink-0">
              Immeuble &bull; {totalUnits} lot{totalUnits > 1 ? "s" : ""}
            </Badge>
            {/* Badge ownership_type (item #14) */}
            {ownershipType === "full" ? (
              <Badge className="bg-emerald-600 text-white shrink-0">
                Propriété complète
              </Badge>
            ) : (
              <>
                <Badge className="bg-amber-600 text-white shrink-0">
                  Copropriété &bull; {totalUnits} lot(s) sur {totalLotsInBuilding || "?"}
                </Badge>
                <Link
                  href="/owner/copro"
                  className="inline-flex items-center gap-1 text-xs text-white/90 hover:text-white underline underline-offset-2 shrink-0"
                >
                  Voir ma copropriété &rarr;
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-white/80 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <EditableField
                value={building.adresse_complete}
                onSave={(val) => patchBuilding({ adresse_complete: val })}
                className="text-white/80"
              />
              <EditableField
                value={building.code_postal}
                onSave={(val) => patchBuilding({ code_postal: val })}
                className="text-white/80 w-16"
              />
              <EditableField
                value={building.ville}
                onSave={(val) => patchBuilding({ ville: val })}
                className="text-white/80"
              />
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-[#2563EB]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{occupancyRate}%</p>
                <p className="text-sm text-muted-foreground">Occupation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Euro className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{revenuActuel.toLocaleString()}€</p>
                <p className="text-sm text-muted-foreground">Revenus/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Euro className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{revenuPotentiel.toLocaleString()}€</p>
                <p className="text-sm text-muted-foreground">Potentiel/mois</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {occupiedUnits}<span className="text-base font-normal text-muted-foreground">/{habitableUnits}</span>
                </p>
                <p className="text-sm text-muted-foreground">Occupés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détails de l'immeuble (item #17) */}
      <Card className="mb-6 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détails de l'immeuble</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="hub-construction-year" className="text-xs">
                Année de construction
              </Label>
              <Input
                id="hub-construction-year"
                type="number"
                min={1800}
                max={new Date().getFullYear() + 5}
                value={constructionYear}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  setConstructionYear(v);
                }}
                onBlur={() => {
                  patchBuilding({
                    construction_year:
                      constructionYear === "" ? null : constructionYear,
                  });
                }}
                placeholder="1960"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hub-surface-totale" className="text-xs">
                Surface totale (m²)
              </Label>
              <Input
                id="hub-surface-totale"
                type="number"
                min={0}
                step="0.01"
                value={surfaceTotale}
                onChange={(e) => {
                  const v = e.target.value === "" ? "" : Number(e.target.value);
                  setSurfaceTotale(v);
                }}
                onBlur={() => {
                  patchBuilding({
                    surface_totale: surfaceTotale === "" ? null : surfaceTotale,
                  });
                }}
                placeholder="280"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hub-floors" className="text-xs">
                Nombre d'étages
              </Label>
              <Input
                id="hub-floors"
                type="number"
                min={1}
                max={50}
                value={buildingMeta?.floors ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v >= 1 && v <= 50) {
                    patchBuilding({ floors: v });
                  }
                }}
                placeholder="4"
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <Label htmlFor="hub-notes" className="text-xs">
              Notes internes
            </Label>
            <Textarea
              id="hub-notes"
              value={buildingNotes}
              onChange={(e) => setBuildingNotes(e.target.value)}
              onBlur={() => patchBuilding({ notes: buildingNotes || null })}
              placeholder="Informations internes sur l'immeuble…"
              rows={2}
              maxLength={2000}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mode de possession (item #14 édition) */}
      <Card className="mb-6 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mode de possession</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="hub-ownership" className="text-xs">
                Type de propriété
              </Label>
              <Select
                value={ownershipType}
                onValueChange={(v) => {
                  const next = v as "full" | "partial";
                  setOwnershipType(next);
                  patchBuilding({
                    ownership_type: next,
                    ...(next === "full" ? { total_lots_in_building: null } : {}),
                  });
                  if (next === "full") setTotalLotsInBuilding("");
                }}
              >
                <SelectTrigger id="hub-ownership" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Immeuble entier</SelectItem>
                  <SelectItem value="partial">Copropriété partielle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ownershipType === "partial" && (
              <div className="space-y-1">
                <Label htmlFor="hub-total-lots" className="text-xs">
                  Nombre total de lots de l'immeuble physique
                </Label>
                <Input
                  id="hub-total-lots"
                  type="number"
                  min={1}
                  value={totalLotsInBuilding}
                  onChange={(e) => {
                    const v = e.target.value === "" ? "" : Number(e.target.value);
                    setTotalLotsInBuilding(v);
                  }}
                  onBlur={() => {
                    if (totalLotsInBuilding !== "") {
                      patchBuilding({ total_lots_in_building: totalLotsInBuilding });
                    }
                  }}
                  placeholder="Ex: 12"
                  className="h-9 text-sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Equipment — Toggles (items #16 : + parking_commun, jardin_commun) */}
      <Card className="mb-8 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Équipements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-0 divide-y sm:divide-y-0">
            <EquipmentToggle label="Ascenseur" checked={equipment.has_ascenseur} onToggle={(v) => handleEquipmentToggle("has_ascenseur", v)} saving={saving} />
            <EquipmentToggle label="Gardien" checked={equipment.has_gardien} onToggle={(v) => handleEquipmentToggle("has_gardien", v)} saving={saving} />
            <EquipmentToggle label="Interphone" checked={equipment.has_interphone} onToggle={(v) => handleEquipmentToggle("has_interphone", v)} saving={saving} />
            <EquipmentToggle label="Digicode" checked={equipment.has_digicode} onToggle={(v) => handleEquipmentToggle("has_digicode", v)} saving={saving} />
            <EquipmentToggle label="Local vélos" checked={equipment.has_local_velo} onToggle={(v) => handleEquipmentToggle("has_local_velo", v)} saving={saving} />
            <EquipmentToggle label="Local poubelles" checked={equipment.has_local_poubelles} onToggle={(v) => handleEquipmentToggle("has_local_poubelles", v)} saving={saving} />
            <EquipmentToggle label="Parking commun" checked={equipment.has_parking_commun} onToggle={(v) => handleEquipmentToggle("has_parking_commun", v)} saving={saving} />
            <EquipmentToggle label="Jardin commun" checked={equipment.has_jardin_commun} onToggle={(v) => handleEquipmentToggle("has_jardin_commun", v)} saving={saving} />
          </div>
          {buildingMeta?.floors && (
            <div className="mt-3 pt-3 border-t">
              <Badge variant="outline">{buildingMeta.floors} étage{(buildingMeta.floors ?? 0) > 1 ? "s" : ""}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SOTA 2026 — Hub managérial à sections stackées (pas de tabs).
          Section 1 : Plan des lots par étage (le grid `Lots par étage` sert
          à la fois de plan et de liste détaillée).
          Section 2 : Documents de gestion de l'immeuble.
          Les tabs ont été supprimés pour aligner la page sur la spec spec
          du skill talok-buildings (1 page = hub managérial complet). */}
      <div className="space-y-8">

        {/* ─── SECTION 1 : Lots par étage ─────────────────────────────── */}
        <section aria-labelledby="building-lots-heading">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-blue-500" />
            <h2 id="building-lots-heading" className="text-xl font-semibold font-[family-name:var(--font-manrope)]">
              Plan des lots
            </h2>
            <Badge variant="outline" className="ml-1">{totalUnits} lot{totalUnits > 1 ? "s" : ""}</Badge>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h2 className="text-xl font-semibold font-[family-name:var(--font-manrope)]">
              Lots par étage
              {hasActiveFilters && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredUnits.length}/{totalUnits})
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterFloor} onValueChange={setFilterFloor}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Étage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les étages</SelectItem>
                  {availableFloors.map((f) => (
                    <SelectItem key={f} value={String(f)}>{floorLabel(f)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {availableTypes.map((t) => (
                    <SelectItem key={t} value={t}>{unitTypeLabels[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupe">Occupé</SelectItem>
                  <SelectItem value="travaux">Travaux</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFilterFloor("all"); setFilterType("all"); setFilterStatus("all"); }}
                >
                  Réinitialiser
                </Button>
              )}
              <Button asChild size="sm">
                <Link href={`/owner/buildings/${building.id}/units`}>
                  <Plus className="mr-1 h-4 w-4" />
                  Ajouter
                </Link>
              </Button>
            </div>
          </div>

          {/* Units by Floor — identical card to /owner/properties */}
          {floors.length > 0 ? (
            <div className="space-y-8">
              <AnimatePresence mode="popLayout">
                {floors.map((floor, floorIndex) => (
                  <motion.section
                    key={floor}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: floorIndex * 0.05 }}
                  >
                    <div className="mb-3 flex items-end justify-between">
                      <h3 className="text-lg font-semibold font-[family-name:var(--font-manrope)]">
                        {floorLabel(floor)}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {unitsByFloor[floor].length} lot{unitsByFloor[floor].length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {unitsByFloor[floor].map((unit) => {
                        const unitType = (unit.type as string) || "appartement";
                        const typeLabel = unitTypeLabels[unitType] || unitType;
                        const status = (unit.status as string) || "vacant";
                        const lease = unit.current_lease_id ? leaseById.get(unit.current_lease_id) : null;
                        const tenant = lease?.tenant_id ? tenantById.get(lease.tenant_id) : null;
                        const lotProperty = unit.property_id ? lotPropertyById.get(unit.property_id) : null;

                        // Badges SmartImageCard alignés avec /owner/properties
                        const badges: Array<{ label: string; variant?: "default" | "secondary" | "outline" | "destructive" }> = [];
                        if (unit.surface) badges.push({ label: `${unit.surface} m²`, variant: "secondary" });
                        if (unit.nb_pieces && unitType !== "parking" && unitType !== "cave") {
                          badges.push({ label: `${unit.nb_pieces} pièce${(unit.nb_pieces || 0) > 1 ? "s" : ""}`, variant: "secondary" });
                        }
                        const loyerTotal = (unit.loyer_hc || 0) + (unit.charges || 0);
                        badges.push({ label: formatCurrency(loyerTotal), variant: "default" });
                        if (status === "occupe" && tenant && (tenant.first_name || tenant.last_name)) {
                          badges.push({
                            label: `${tenant.first_name ?? ""} ${tenant.last_name ?? ""}`.trim(),
                            variant: "outline",
                          });
                        }
                        if (status === "occupe" && lease?.date_fin) {
                          badges.push({
                            label: `Fin ${formatDateShort(lease.date_fin)}`,
                            variant: "outline",
                          });
                        }

                        const statusBadge = (
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium border shadow-sm backdrop-blur-md ${statusStyles[status] ?? statusStyles.vacant}`}
                          >
                            {statusLabels[status] ?? status}
                          </span>
                        );

                        const subtitle = `${typeLabel} • Lot ${unit.position ?? ""}`.trim();
                        const title = lotProperty?.adresse_complete || `${typeLabel} ${unit.position ?? ""}`.trim();
                        const href = unit.property_id
                          ? `/owner/properties/${unit.property_id}`
                          : `/owner/buildings/${building.id}`;

                        return (
                          <motion.div key={unit.id} layout className="relative group">
                            <Link href={href} className="block h-full">
                              <SmartImageCard
                                src={lotProperty?.cover_url ?? null}
                                alt={title}
                                title={title}
                                subtitle={subtitle}
                                badges={badges}
                                status={statusBadge}
                              />
                            </Link>

                            {/* Actions dropdown — superposé à la card */}
                            <div className="absolute top-3 right-3 z-40">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  {unit.property_id && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/owner/properties/${unit.property_id}`}>
                                        <FileText className="h-3.5 w-3.5 mr-2" />
                                        Fiche du bien
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {/* Item #5 : Drawer caractéristiques lot (DPE, chauffage, équipements, meublé) */}
                                  {unit.property_id && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setDrawerLot({
                                          propertyId: unit.property_id as string,
                                          label: `Lot ${unit.position ?? ""} · ${floorLabel((unit.floor as number) ?? 0)}`,
                                        })
                                      }
                                    >
                                      <Sparkles className="h-3.5 w-3.5 mr-2" />
                                      Caractéristiques (DPE, chauffage…)
                                    </DropdownMenuItem>
                                  )}
                                  {status === "occupe" && unit.current_lease_id && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/owner/leases/${unit.current_lease_id}`}>
                                        <Eye className="h-3.5 w-3.5 mr-2" />
                                        Voir le bail
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  {status !== "occupe" && unit.property_id && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/owner/leases/new?propertyId=${unit.property_id}&buildingUnitId=${unit.id}`}>
                                        <Plus className="h-3.5 w-3.5 mr-2" />
                                        Créer un bail
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {/* Item #25 : Dupliquer sur d'autres étages */}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!unit.id) return;
                                      setDuplicateSource({
                                        unitId: unit.id,
                                        sourceFloor: (unit.floor as number) ?? 0,
                                      });
                                      setDuplicateTargetFloors([]);
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5 mr-2" />
                                    Dupliquer sur d'autres étages
                                  </DropdownMenuItem>
                                  {status !== "travaux" && (
                                    <DropdownMenuItem onClick={() => unit.id && handleUnitStatusChange(unit.id, "travaux")}>
                                      <Wrench className="h-3.5 w-3.5 mr-2" />
                                      Marquer en travaux
                                    </DropdownMenuItem>
                                  )}
                                  {status !== "vacant" && !unit.current_lease_id && (
                                    <DropdownMenuItem onClick={() => unit.id && handleUnitStatusChange(unit.id, "vacant")}>
                                      <Home className="h-3.5 w-3.5 mr-2" />
                                      Marquer vacant
                                    </DropdownMenuItem>
                                  )}
                                  {!unit.current_lease_id && status !== "occupe" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600 focus:text-red-600">
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Supprimer le lot
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Supprimer ce lot ?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Le lot {typeLabel} {unit.position} sera définitivement supprimé. Cette action est irréversible.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => unit.id && handleUnitDelete(unit.id)}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              Supprimer
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.section>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <Card className="bg-card">
              <CardContent className="py-12 text-center">
                <Layers className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters
                    ? "Aucun lot ne correspond aux filtres sélectionnés"
                    : "Aucun lot configuré pour cet immeuble"}
                </p>
                {hasActiveFilters ? (
                  <Button
                    variant="outline"
                    onClick={() => { setFilterFloor("all"); setFilterType("all"); setFilterStatus("all"); }}
                  >
                    Réinitialiser les filtres
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href={`/owner/buildings/${building.id}/units`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Ajouter des lots
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {/* ─── SECTION 2 : Documents de gestion ─────────────────────── */}
        <section aria-labelledby="building-documents-heading">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-5 w-5 text-blue-500" />
            <h2 id="building-documents-heading" className="text-xl font-semibold font-[family-name:var(--font-manrope)]">
              Documents de gestion
            </h2>
            <Badge variant="outline" className="ml-1">{documents.length} document{documents.length > 1 ? "s" : ""}</Badge>
          </div>

          {/* Upload section */}
          <Card className="mb-6 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ajouter un document</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger className="sm:w-[280px]">
                    <SelectValue placeholder="Type de document" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.type} value={dt.type}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDocUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  variant="outline"
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Envoi..." : "Choisir un fichier"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Documents grid by category */}
          {BUILDING_DOCUMENT_TYPES.map((dt) => {
            const docs = documentsByType.get(dt.type) || [];
            const expiry = docs[0]?.expiry_date || docs[0]?.valid_until;
            const expiryStatus = dt.hasExpiry ? getExpiryStatus(expiry) : null;

            return (
              <div key={dt.type} className="mb-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-[#2563EB]/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                      <FileText className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{dt.label}</p>
                      {docs.length > 0 ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {docs[0].original_filename} • {formatFileSize(docs[0].file_size)}
                          {docs.length > 1 && ` (+${docs.length - 1})`}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Non fourni</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {docs.length > 0 ? (
                      <>
                        {expiryStatus === "expired" && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="h-3 w-3" /> Expiré
                          </Badge>
                        )}
                        {expiryStatus === "expiring" && (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1">
                            <Clock className="h-3 w-3" /> Expire bientôt
                          </Badge>
                        )}
                        {(expiryStatus === "ok" || expiryStatus === null) && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Fourni
                          </Badge>
                        )}
                      </>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                        <X className="h-3 w-3" /> Manquant
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => {
                        setSelectedDocType(dt.type);
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Extra documents not in the predefined list */}
          {documents
            .filter(d => !BUILDING_DOCUMENT_TYPES.some(dt => dt.type === d.type))
            .map(doc => (
              <div key={doc.id} className="mb-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                      <FileText className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {TYPE_TO_LABEL[doc.type as DocumentType] || doc.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.original_filename} • {formatFileSize(doc.file_size)}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs gap-1 shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Fourni
                  </Badge>
                </div>
              </div>
            ))}
        </section>

      </div>

      {/* Drawer caractéristiques lot (item #5) */}
      {drawerLot && (
        <LotCharacteristicsDrawer
          open={!!drawerLot}
          onOpenChange={(o) => {
            if (!o) setDrawerLot(null);
          }}
          propertyId={drawerLot.propertyId}
          unitLabel={drawerLot.label}
        />
      )}

      {/* Dialog de duplication lot (item #25) */}
      <Dialog
        open={!!duplicateSource}
        onOpenChange={(o) => {
          if (!o) {
            setDuplicateSource(null);
            setDuplicateTargetFloors([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-500" />
              Dupliquer ce lot
            </DialogTitle>
            <DialogDescription>
              Sélectionnez les étages sur lesquels recréer ce lot. Les nouveaux lots
              seront créés à la prochaine position disponible, avec le même loyer,
              la même surface et le statut <em>vacant</em>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label className="text-xs mb-2 block">Étages cibles</Label>
            <div className="flex flex-wrap gap-2">
              {duplicateCandidateFloors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun autre étage disponible. Ajoutez un étage dans les détails
                  de l'immeuble pour en créer.
                </p>
              ) : (
                duplicateCandidateFloors.map((f) => {
                  const isSelected = duplicateTargetFloors.includes(f);
                  return (
                    <Button
                      key={f}
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => {
                        setDuplicateTargetFloors((prev) =>
                          prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                        );
                      }}
                    >
                      {floorLabel(f)}
                    </Button>
                  );
                })
              )}
            </div>
            {duplicateCandidateFloors.length > 0 && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDuplicateTargetFloors(duplicateCandidateFloors)}
                >
                  Tous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDuplicateTargetFloors([])}
                >
                  Aucun
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDuplicateSource(null);
                setDuplicateTargetFloors([]);
              }}
              disabled={duplicating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleDuplicateSubmit}
              disabled={duplicating || duplicateTargetFloors.length === 0}
            >
              {duplicating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Duplication…
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Dupliquer ({duplicateTargetFloors.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression immeuble */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleting) setDeleteDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Supprimer l&apos;immeuble
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                {deleteGuardLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Vérification des dépendances…
                  </div>
                ) : deleteGuard ? (
                  <>
                    {/* Blockers */}
                    {deleteGuard.blockers.length > 0 && (
                      <div className="space-y-1">
                        {deleteGuard.blockers.map((b, i) => (
                          <p key={i} className="text-red-500 text-sm flex items-start gap-1.5">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            {b}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Lots cascade info */}
                    {deleteGuard.lots && deleteGuard.lots.length > 0 && (
                      <div className="rounded-md border p-3">
                        <p className="font-medium text-sm text-foreground mb-2">
                          {deleteGuard.lots.length} lot{deleteGuard.lots.length > 1 ? "s" : ""} {deleteGuard.lots.length > 1 ? "seront" : "sera"} supprimé{deleteGuard.lots.length > 1 ? "s" : ""} :
                        </p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {deleteGuard.lots.map((lot) => (
                            <div key={lot.id} className="flex items-center gap-2 text-sm">
                              <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-foreground truncate">{lot.adresse || lot.id}</span>
                              {lot.hasActiveLease && (
                                <Badge variant="destructive" className="text-xs shrink-0">Bail actif</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {deleteGuard.warnings.length > 0 && (
                      <div className="space-y-1">
                        {deleteGuard.warnings.map((w, i) => (
                          <p key={i} className="text-orange-500 text-sm flex items-start gap-1.5">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground">
                      Cette action est irréversible. L&apos;immeuble et ses lots seront archivés.
                    </p>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteGuardLoading || !deleteGuard || deleteGuard.blockers.length > 0 || deleting}
              onClick={(e) => { e.preventDefault(); handleDeleteBuilding(); }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppression…
                </>
              ) : (
                "Supprimer définitivement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

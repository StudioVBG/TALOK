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
  DoorOpen,
  Car,
  Store,
  MoreHorizontal,
  Users,
  Euro,
  TrendingUp,
  Filter,
  FileText,
  Pencil,
  Check,
  X,
  Upload,
  AlertCircle,
  Clock,
  CheckCircle2,
  FolderOpen,
  Wrench,
  Eye,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import Image from "next/image";
import type { BuildingRow, BuildingUnitRow } from "@/lib/supabase/database.types";
import { TYPE_TO_LABEL, type DocumentType } from "@/lib/documents/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  units: Array<Partial<BuildingUnitRow>>;
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

const unitTypeIcons: Record<string, typeof Home> = {
  appartement: Home,
  studio: DoorOpen,
  local_commercial: Store,
  parking: Car,
  cave: Layers,
  bureau: Building2,
};

const unitTypeLabels: Record<string, string> = {
  appartement: "Appartement",
  studio: "Studio",
  local_commercial: "Local commercial",
  parking: "Parking",
  cave: "Cave",
  bureau: "Bureau",
};

const statusColors: Record<string, string> = {
  vacant: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  occupe: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  travaux: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  reserve: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
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
  documents: initialDocuments,
}: BuildingDetailClientProps) {
  const { toast } = useToast();

  // ── Inline editing state ──
  const [saving, setSaving] = useState(false);
  const [equipment, setEquipment] = useState({
    has_ascenseur: buildingMeta?.has_ascenseur ?? false,
    has_gardien: buildingMeta?.has_gardien ?? false,
    has_interphone: buildingMeta?.has_interphone ?? false,
    has_digicode: buildingMeta?.has_digicode ?? false,
    has_local_velo: buildingMeta?.has_local_velo ?? false,
    has_local_poubelles: buildingMeta?.has_local_poubelles ?? false,
  });

  // ── Documents state ──
  const [documents, setDocuments] = useState<BuildingDocument[]>(initialDocuments || []);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("assurance_pno");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Erreur d'upload");

      const result = await res.json();
      const doc = result.document || result;

      // Get signed URL for the uploaded photo to use as cover
      const urlRes = await fetch(`/api/documents/${doc.id}/signed-url`);
      if (urlRes.ok) {
        const urlData = await urlRes.json();
        const newCoverUrl = urlData.signedUrl || urlData.url;
        setCoverUrl(newCoverUrl);

        // Persist cover_url on property
        await fetch(`/api/properties/${propertyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cover_url: newCoverUrl }),
        }).catch(() => {});
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

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur lors de l'upload");
      }
      const result = await res.json();
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

  const unitsByFloor = filteredUnits.reduce<Record<number, typeof units>>((acc, unit) => {
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
  const occupiedUnits = liveUnits.filter((u) => u.status === "occupe" && u.type !== "parking" && u.type !== "cave").length;
  const occupancyRate = habitableUnits > 0 ? Math.round((occupiedUnits / habitableUnits) * 100) : 0;
  const revenuActuel = liveUnits.filter((u) => u.status === "occupe").reduce((sum, u) => sum + (u.loyer_hc || 0) + (u.charges || 0), 0);
  const revenuPotentiel = liveUnits.reduce((sum, u) => sum + (u.loyer_hc || 0) + (u.charges || 0), 0);
  const hasActiveFilters = filterFloor !== "all" || filterType !== "all" || filterStatus !== "all";

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
        {/* Cover photo button */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
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
                value={building.adresse_complete}
                onSave={(val) => patchBuilding({ adresse_complete: val })}
                className="text-white"
              />
            </h1>
            <Badge className="bg-[#2563EB] text-white shrink-0">
              Immeuble &bull; {totalUnits} lot{totalUnits > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-white/80 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
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

      {/* Equipment — Toggles */}
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
          </div>
          {buildingMeta?.floors && (
            <div className="mt-3 pt-3 border-t">
              <Badge variant="outline">{buildingMeta.floors} étage{(buildingMeta.floors ?? 0) > 1 ? "s" : ""}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Lots | Documents */}
      <Tabs defaultValue="lots" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lots" className="gap-1.5">
            <Layers className="h-4 w-4" />
            Lots ({totalUnits})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            Documents ({documents.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB: Lots ──────────────────────────────────────────────── */}
        <TabsContent value="lots">
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

          {/* Units by Floor */}
          {floors.length > 0 ? (
            <div className="space-y-6">
              <AnimatePresence mode="popLayout">
                {floors.map((floor, floorIndex) => (
                  <motion.div
                    key={floor}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: floorIndex * 0.05 }}
                  >
                    <Card className="bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{floorLabel(floor)}</CardTitle>
                        <CardDescription>
                          {unitsByFloor[floor].length} lot{unitsByFloor[floor].length > 1 ? "s" : ""}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {unitsByFloor[floor].map((unit) => {
                            const Icon = unitTypeIcons[unit.type || "appartement"] || Home;
                            return (
                              <motion.div
                                key={unit.id}
                                layout
                                className="border rounded-lg p-4 hover:border-[#2563EB]/40 transition-colors bg-card"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {unitTypeLabels[unit.type || "appartement"]} {unit.position}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {unit.template && `${(unit.template as string).toUpperCase()} • `}
                                        {unit.surface}m² • {unit.nb_pieces} pièce{(unit.nb_pieces || 0) > 1 ? "s" : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {unit.property_id && (
                                        <DropdownMenuItem asChild>
                                          <Link href={`/owner/properties/${unit.property_id}`}>
                                            <FileText className="h-3.5 w-3.5 mr-2" />
                                            Fiche du bien
                                          </Link>
                                        </DropdownMenuItem>
                                      )}
                                      {unit.status === "occupe" && unit.current_lease_id && (
                                        <DropdownMenuItem asChild>
                                          <Link href={`/owner/leases/${unit.current_lease_id}`}>
                                            <Eye className="h-3.5 w-3.5 mr-2" />
                                            Voir le bail
                                          </Link>
                                        </DropdownMenuItem>
                                      )}
                                      {unit.status !== "occupe" && unit.property_id && (
                                        <DropdownMenuItem asChild>
                                          <Link href={`/owner/leases/new?propertyId=${unit.property_id}&buildingUnitId=${unit.id}`}>
                                            <Plus className="h-3.5 w-3.5 mr-2" />
                                            Créer un bail
                                          </Link>
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      {unit.status !== "travaux" && (
                                        <DropdownMenuItem onClick={() => unit.id && handleUnitStatusChange(unit.id, "travaux")}>
                                          <Wrench className="h-3.5 w-3.5 mr-2" />
                                          Marquer en travaux
                                        </DropdownMenuItem>
                                      )}
                                      {unit.status !== "vacant" && !unit.current_lease_id && (
                                        <DropdownMenuItem onClick={() => unit.id && handleUnitStatusChange(unit.id, "vacant")}>
                                          <Home className="h-3.5 w-3.5 mr-2" />
                                          Marquer vacant
                                        </DropdownMenuItem>
                                      )}
                                      {!unit.current_lease_id && unit.status !== "occupe" && (
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
                                                  Le lot {unitTypeLabels[unit.type || "appartement"]} {unit.position} sera définitivement supprimé. Cette action est irréversible.
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
                                <div className="flex items-center justify-between">
                                  <Badge className={statusColors[unit.status || "vacant"]}>
                                    {statusLabels[unit.status || "vacant"]}
                                  </Badge>
                                  <div className="text-right">
                                    <p className="font-semibold text-[#2563EB]">
                                      {(unit.loyer_hc || 0).toLocaleString()}€
                                      <span className="text-xs font-normal text-muted-foreground">/mois</span>
                                    </p>
                                    {(unit.charges || 0) > 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        + {(unit.charges || 0).toLocaleString()}€ charges
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
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
        </TabsContent>

        {/* ─── TAB: Documents ─────────────────────────────────────────── */}
        <TabsContent value="documents">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

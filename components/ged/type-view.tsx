"use client";
// @ts-nocheck

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { ExpiryBadge } from "./expiry-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Search, FileText, Download, Eye, MoreVertical,
  Filter, ArrowUpDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateShort } from "@/lib/helpers/format";
import { DOCUMENT_TYPES } from "@/lib/owner/constants";
import type { GedDocument, GedDocumentCategory } from "@/lib/types/ged";
import { GED_CATEGORY_LABELS, GED_STATUS_LABELS, GED_STATUS_COLORS } from "@/lib/types/ged";

interface TypeViewProps {
  documents: GedDocument[];
  isLoading: boolean;
  onPreview?: (doc: GedDocument) => void;
  onDownload?: (doc: GedDocument) => void;
  onDelete?: (doc: GedDocument) => void;
  className?: string;
}

/**
 * Vue par type GED: Tableau filtrable pour les gestionnaires pro.
 * Affiche un résumé en haut et un tableau paginé.
 */
export function TypeView({
  documents,
  isLoading,
  onPreview,
  onDownload,
  onDelete,
  className,
}: TypeViewProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "type" | "expiry">("date");

  // Filtrage et tri
  const filteredDocs = useMemo(() => {
    let result = [...documents];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.title && d.title.toLowerCase().includes(q)) ||
          (d.type_label && d.type_label.toLowerCase().includes(q)) ||
          (d.original_filename && d.original_filename.toLowerCase().includes(q)) ||
          (d.property?.adresse_complete && d.property.adresse_complete.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter((d) => d.type_category === categoryFilter);
    }

    if (statusFilter === "expired") {
      result = result.filter((d) => d.expiry_status === "expired");
    } else if (statusFilter === "expiring") {
      result = result.filter(
        (d) => d.expiry_status === "expiring_soon" || d.expiry_status === "expiring_notice"
      );
    } else if (statusFilter === "valid") {
      result = result.filter(
        (d) => d.expiry_status === "valid" || d.expiry_status === null
      );
    }

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case "type":
          return (a.type_label || "").localeCompare(b.type_label || "");
        case "expiry":
          if (a.days_until_expiry === null && b.days_until_expiry === null) return 0;
          if (a.days_until_expiry === null) return 1;
          if (b.days_until_expiry === null) return -1;
          return a.days_until_expiry - b.days_until_expiry;
        case "date":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [documents, search, categoryFilter, statusFilter, sortBy]);

  // Résumé compteurs
  const summary = useMemo(() => {
    const valid = documents.filter((d) => d.expiry_status === "valid" || !d.expiry_status).length;
    const expiring = documents.filter(
      (d) => d.expiry_status === "expiring_soon" || d.expiry_status === "expiring_notice"
    ).length;
    const expired = documents.filter((d) => d.expiry_status === "expired").length;
    return { valid, expiring, expired, total: documents.length };
  }, [documents]);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Columns for ResponsiveTable
  const columns = [
    {
      header: "Document",
      cell: (doc: GedDocument) => (
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {doc.title || doc.type_label || doc.original_filename || "Sans titre"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {doc.type_label_short || doc.type}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Catégorie",
      cell: (doc: GedDocument) => (
        <Badge variant="secondary" className="text-xs">
          {doc.type_category ? GED_CATEGORY_LABELS[doc.type_category] : "-"}
        </Badge>
      ),
    },
    {
      header: "Bien",
      cell: (doc: GedDocument) => (
        <span className="text-sm truncate max-w-[180px] block">
          {doc.property?.ville || doc.property?.adresse_complete || "-"}
        </span>
      ),
    },
    {
      header: "Statut",
      cell: (doc: GedDocument) => (
        <div className="flex flex-col gap-1">
          {doc.ged_status && doc.ged_status !== "active" && (
            <StatusBadge
              status={GED_STATUS_LABELS[doc.ged_status]}
              type={GED_STATUS_COLORS[doc.ged_status]}
              animate={false}
            />
          )}
          {doc.expiry_status && (
            <ExpiryBadge
              status={doc.expiry_status}
              daysUntilExpiry={doc.days_until_expiry}
            />
          )}
          {!doc.expiry_status && doc.ged_status === "active" && (
            <span className="text-xs text-muted-foreground">Actif</span>
          )}
        </div>
      ),
    },
    {
      header: "Date",
      className: "text-right",
      cell: (doc: GedDocument) => (
        <div className="text-right">
          <p className="text-sm">{formatDateShort(doc.created_at)}</p>
          {doc.valid_until && (
            <p className="text-xs text-muted-foreground">
              Exp. {formatDateShort(doc.valid_until)}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "",
      className: "w-10",
      cell: (doc: GedDocument) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPreview && (
              <DropdownMenuItem onClick={() => onPreview(doc)}>
                <Eye className="mr-2 h-4 w-4" /> Voir
              </DropdownMenuItem>
            )}
            {onDownload && (
              <DropdownMenuItem onClick={() => onDownload(doc)}>
                <Download className="mr-2 h-4 w-4" /> Télécharger
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(doc)}>
                <MoreVertical className="mr-2 h-4 w-4" /> Supprimer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={summary.total} variant="neutral" />
        <SummaryCard label="Valides" value={summary.valid} variant="success" />
        <SummaryCard label="A renouveler" value={summary.expiring} variant="warning" />
        <SummaryCard label="Expirés" value={summary.expired} variant="error" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un document..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {Object.entries(GED_CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="valid">Valides</SelectItem>
            <SelectItem value="expiring">A renouveler</SelectItem>
            <SelectItem value="expired">Expirés</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Par date</SelectItem>
            <SelectItem value="type">Par type</SelectItem>
            <SelectItem value="expiry">Par expiration</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun document trouvé"
          description="Modifiez vos filtres pour voir d'autres documents."
        />
      ) : (
        <ResponsiveTable
          data={filteredDocs}
          columns={columns}
          keyExtractor={(item) => item.id}
          onRowClick={onPreview ? (item) => onPreview(item) : undefined}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "warning" | "error" | "neutral";
}) {
  const styles = {
    success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10",
    warning: "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10",
    error: "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10",
    neutral: "border-border bg-muted/30",
  };

  const textStyles = {
    success: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    error: "text-rose-700 dark:text-rose-400",
    neutral: "text-foreground",
  };

  return (
    <div className={cn("rounded-lg border p-3 text-center", styles[variant])}>
      <p className={cn("text-2xl font-bold", textStyles[variant])}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Search,
  Download,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { TYPE_TO_LABEL, DOCUMENT_TYPES } from "@/lib/documents/constants";

interface DocumentRow {
  id: string;
  type: string;
  title: string | null;
  original_filename: string | null;
  visible_tenant: boolean | null;
  is_generated: boolean | null;
  created_at: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string | null;
  owner: { id: string; nom: string | null; prenom: string | null } | null;
  tenant: { id: string; nom: string | null; prenom: string | null } | null;
  property: { id: string; adresse_complete: string | null } | null;
}

interface Filters {
  search: string;
  type: string;
  owner_id: string;
  tenant_id: string;
  property_id: string;
  from: string;
  to: string;
}

interface Props {
  documents: DocumentRow[];
  total: number;
  page: number;
  limit: number;
  filters: Filters;
}

function profileName(p: { nom: string | null; prenom: string | null } | null): string {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ") || "—";
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminDocumentsClient({ documents, total, page, limit, filters }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(filters.search);
  const [type, setType] = useState(filters.type);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(
    Boolean(filters.type || filters.owner_id || filters.tenant_id || filters.property_id || filters.from || filters.to)
  );

  const totalPages = Math.ceil(total / limit);

  const applyFilters = useCallback(
    (overrides: Partial<Filters> = {}) => {
      const params = new URLSearchParams();
      const merged = { search, type, from, to, owner_id: filters.owner_id, tenant_id: filters.tenant_id, property_id: filters.property_id, ...overrides };
      if (merged.search) params.set("search", merged.search);
      if (merged.type) params.set("type", merged.type);
      if (merged.owner_id) params.set("owner_id", merged.owner_id);
      if (merged.tenant_id) params.set("tenant_id", merged.tenant_id);
      if (merged.property_id) params.set("property_id", merged.property_id);
      if (merged.from) params.set("from", merged.from);
      if (merged.to) params.set("to", merged.to);
      // Reset to page 1 on filter change
      const qs = params.toString();
      router.push(`/admin/documents${qs ? `?${qs}` : ""}`);
    },
    [router, search, type, from, to, filters]
  );

  const goToPage = (p: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.type) params.set("type", filters.type);
    if (filters.owner_id) params.set("owner_id", filters.owner_id);
    if (filters.tenant_id) params.set("tenant_id", filters.tenant_id);
    if (filters.property_id) params.set("property_id", filters.property_id);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    router.push(`/admin/documents${qs ? `?${qs}` : ""}`);
  };

  const clearFilters = () => {
    setSearch("");
    setType("");
    setFrom("");
    setTo("");
    router.push("/admin/documents");
  };

  const toggleVisibleTenant = async (docId: string, currentValue: boolean) => {
    setTogglingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible_tenant: !currentValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }
      toast({ title: !currentValue ? "Document rendu visible au locataire" : "Document masqué au locataire" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de modifier la visibilité",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {total} document{total !== 1 ? "s" : ""} au total
        </p>
      </div>

      {/* Search + filters bar */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* Search row */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters({ search })}
                className="pl-9"
              />
            </div>
            <Button onClick={() => applyFilters({ search })} size="sm" className="shrink-0">
              Rechercher
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="shrink-0 gap-1"
            >
              <Filter className="h-4 w-4" />
              Filtres
            </Button>
            {(filters.search || filters.type || filters.from || filters.to) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 gap-1">
                <X className="h-4 w-4" /> Effacer
              </Button>
            )}
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <Select value={type || "__all__"} onValueChange={(v) => { const val = v === "__all__" ? "" : v; setType(val); applyFilters({ type: val }); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous les types</SelectItem>
                    {DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {(TYPE_TO_LABEL as Record<string, string>)[t] || t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Du</label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); }}
                  onBlur={() => applyFilters({ from })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Au</label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); }}
                  onBlur={() => applyFilters({ to })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Titre</TableHead>
                  <TableHead className="min-w-[120px]">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Propriétaire</TableHead>
                  <TableHead className="hidden md:table-cell">Locataire</TableHead>
                  <TableHead className="hidden lg:table-cell">Bien</TableHead>
                  <TableHead className="min-w-[90px]">Date</TableHead>
                  <TableHead className="text-center min-w-[80px]">Visible</TableHead>
                  <TableHead className="text-right min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Aucun document trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm truncate max-w-[250px]">
                            {doc.title || doc.original_filename || "Sans titre"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(doc.file_size)}
                            {doc.is_generated && (
                              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4">
                                Auto
                              </Badge>
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {(TYPE_TO_LABEL as Record<string, string>)[doc.type] || doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {profileName(doc.owner)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {profileName(doc.tenant)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm truncate max-w-[180px]">
                        {doc.property?.adresse_complete || "—"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={togglingId === doc.id}
                          onClick={() => toggleVisibleTenant(doc.id, Boolean(doc.visible_tenant))}
                          className={cn(
                            "h-8 w-8 p-0",
                            doc.visible_tenant ? "text-emerald-600 hover:text-emerald-700" : "text-muted-foreground hover:text-foreground"
                          )}
                          title={doc.visible_tenant ? "Visible par le locataire" : "Masqué au locataire"}
                        >
                          {togglingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : doc.visible_tenant ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {doc.storage_path && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              asChild
                              title="Télécharger"
                            >
                              <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

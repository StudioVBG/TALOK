"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  FolderOpen,
  FileText,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DocumentRow {
  id: string;
  title: string;
  type: string;
  ownerName: string;
  sizeBytes: number | null;
  createdAt: string;
  storagePath: string | null;
}

interface ApiResponse {
  documents: DocumentRow[];
  stats: {
    total: number;
    byType: Record<string, number>;
    knownTypes: Record<string, string>;
  };
}

const TYPE_COLORS: Record<string, string> = {
  bail: "border-purple-500 text-purple-600 bg-purple-50",
  EDL_entree: "border-sky-500 text-sky-600 bg-sky-50",
  EDL_sortie: "border-sky-500 text-sky-600 bg-sky-50",
  quittance: "border-emerald-500 text-emerald-600 bg-emerald-50",
  attestation_assurance: "border-amber-500 text-amber-600 bg-amber-50",
  attestation_loyer: "border-amber-500 text-amber-600 bg-amber-50",
  justificatif_revenus: "border-indigo-500 text-indigo-600 bg-indigo-50",
  piece_identite: "border-slate-500 text-slate-600 bg-slate-50",
  mandat: "border-indigo-500 text-indigo-600 bg-indigo-50",
  facture: "border-amber-500 text-amber-600 bg-amber-50",
  autre: "border-slate-400 text-slate-600 bg-slate-50",
};

const formatSize = (bytes: number | null): string => {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const buildFileUrl = (storagePath: string | null, disposition: "inline" | "attachment", filename?: string): string | null => {
  if (!storagePath) return null;
  const params = new URLSearchParams({ path: storagePath, disposition });
  if (filename) params.set("filename", filename);
  return `/api/documents/file?${params.toString()}`;
};

export default function AgencyDocumentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [stats, setStats] = useState<ApiResponse["stats"]>({
    total: 0,
    byType: {},
    knownTypes: {},
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/agency/documents");
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "Erreur de chargement");
        }
        const data = (await response.json()) as ApiResponse;
        if (cancelled) return;
        setDocuments(data.documents ?? []);
        setStats(data.stats);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur inconnue");
          setDocuments([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(q) || doc.ownerName.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || doc.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, typeFilter]);

  const visibleTypes = useMemo(() => {
    const known = stats.knownTypes ?? {};
    return Object.entries(known)
      .map(([key, label]) => ({
        key,
        label,
        count: stats.byType?.[key] ?? 0,
      }))
      .filter((t) => t.count > 0)
      .slice(0, 5);
  }, [stats]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Documents
          </h1>
          <p className="text-muted-foreground mt-1">Documents liés aux biens sous mandat</p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50/60 dark:bg-red-900/20">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {visibleTypes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {visibleTypes.map((t) => (
            <Card
              key={t.key}
              className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm"
            >
              <CardContent className="p-4 text-center">
                <Badge
                  variant="outline"
                  className={cn("text-xs mb-2", TYPE_COLORS[t.key] ?? TYPE_COLORS.autre)}
                >
                  {t.label}
                </Badge>
                <p className="text-2xl font-bold">{t.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un document ou un propriétaire…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(stats.knownTypes ?? {}).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Chargement…
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "Aucun document n'est associé à vos mandats pour l'instant."
                  : "Aucun document ne correspond à votre recherche."}
              </p>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3 p-4">
                {filteredDocs.map((doc) => {
                  const label = stats.knownTypes?.[doc.type] ?? doc.type;
                  const previewUrl = buildFileUrl(doc.storagePath, "inline");
                  const downloadUrl = buildFileUrl(doc.storagePath, "attachment", doc.title);
                  return (
                    <div key={doc.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.title}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs mt-1",
                              TYPE_COLORS[doc.type] ?? TYPE_COLORS.autre,
                            )}
                          >
                            {label}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {previewUrl && (
                              <DropdownMenuItem asChild>
                                <a href={previewUrl} target="_blank" rel="noreferrer">
                                  <Eye className="w-4 h-4 mr-2" />
                                  Aperçu
                                </a>
                              </DropdownMenuItem>
                            )}
                            {downloadUrl && (
                              <DropdownMenuItem asChild>
                                <a href={downloadUrl}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Télécharger
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{doc.ownerName}</span>
                        <span>
                          {formatSize(doc.sizeBytes)} • {formatDate(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Document</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Taille</th>
                      <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => {
                      const label = stats.knownTypes?.[doc.type] ?? doc.type;
                      const previewUrl = buildFileUrl(doc.storagePath, "inline");
                      const downloadUrl = buildFileUrl(doc.storagePath, "attachment", doc.title);
                      return (
                        <tr
                          key={doc.id}
                          className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                              </div>
                              <span className="font-medium text-sm">{doc.title}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                TYPE_COLORS[doc.type] ?? TYPE_COLORS.autre,
                              )}
                            >
                              {label}
                            </Badge>
                          </td>
                          <td className="py-4 px-4 text-sm text-muted-foreground">
                            {doc.ownerName}
                          </td>
                          <td className="py-4 px-4 text-right text-sm text-muted-foreground">
                            {formatSize(doc.sizeBytes)}
                          </td>
                          <td className="py-4 px-4 text-right text-sm text-muted-foreground">
                            {formatDate(doc.createdAt)}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {previewUrl && (
                                  <DropdownMenuItem asChild>
                                    <a href={previewUrl} target="_blank" rel="noreferrer">
                                      <Eye className="w-4 h-4 mr-2" />
                                      Aperçu
                                    </a>
                                  </DropdownMenuItem>
                                )}
                                {downloadUrl && (
                                  <DropdownMenuItem asChild>
                                    <a href={downloadUrl}>
                                      <Download className="w-4 h-4 mr-2" />
                                      Télécharger
                                    </a>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
import { Search, FileText, Upload, Download, Trash2, Eye } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { DOCUMENT_TYPES, DOCUMENT_STATUS_LABELS } from "@/lib/owner/constants";
import { ownerDocumentRoutes } from "@/lib/owner/routes";
import type { DocumentRow } from "../_data/fetchDocuments";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusBadge } from "@/components/ui/status-badge";

interface OwnerDocumentsClientProps {
  initialDocuments: DocumentRow[];
}

export function OwnerDocumentsClient({ initialDocuments }: OwnerDocumentsClientProps) {
  const searchParams = useSearchParams();
  const propertyIdFilter = searchParams.get("property_id");

  // Plus de fetching client-side, on utilise uniquement les props
  const documents = initialDocuments;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filtrer les documents (filtrage client-side sur les 50 derniers chargés)
  let filteredDocuments = documents;

  if (propertyIdFilter) {
    filteredDocuments = filteredDocuments.filter(
      (doc: any) => doc.property_id === propertyIdFilter
    );
  }

  if (typeFilter !== "all") {
    filteredDocuments = filteredDocuments.filter((doc: any) => doc.type === typeFilter);
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

  // Colonnes SOTA
  const columns = [
    {
        header: "Document",
        cell: (doc: any) => (
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm border border-indigo-100">
                    <FileText className="h-5 w-5" />
                </div>
                <div>
                    <span className="font-semibold text-slate-900 block">{doc.title || getTypeLabel(doc.type || "")}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">{getTypeLabel(doc.type || "")}</span>
                </div>
            </div>
        )
    },
    {
        header: "Bien associé",
        cell: (doc: any) => (
            <span className="text-sm text-slate-600 font-medium">
                {doc.property?.adresse_complete || "Général"}
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
            <div className="flex justify-end gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600"
                    onClick={() => {
                    if (doc.storage_path) {
                        window.open(doc.storage_path, "_blank");
                    }
                    }}
                >
                    <Download className="h-4 w-4" />
                </Button>
            </div>
        )
    }
  ];

  return (
    <PageTransition>
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
            <div className="grid gap-4 md:grid-cols-4">
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
          {filteredDocuments.length === 0 ? (
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
    </PageTransition>
  );
}

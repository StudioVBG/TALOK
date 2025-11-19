"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Upload, Download } from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES, DOCUMENT_STATUS_LABELS } from "@/lib/owner/constants";
import { ownerDocumentRoutes } from "@/lib/owner/routes";

// On utilise le type retourné par notre nouvelle API
import type { DocumentRow } from "../_data/fetchDocuments";

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

  // Note: 'statut' n'est pas dans DocumentRow de base, il faudrait l'ajouter si présent en base.
  // Si absent, on ignore le filtre statut pour l'instant ou on assume 'active'.
  if (statusFilter !== "all") {
     // filteredDocuments = filteredDocuments.filter((doc: any) => doc.statut === statusFilter);
  }

  if (searchQuery) {
    filteredDocuments = filteredDocuments.filter((doc: any) =>
      (doc.type?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (doc.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (doc.property?.adresse_complete?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
  }

  const getTypeLabel = (type: string) => {
    // @ts-ignore - DOCUMENT_TYPES peut ne pas avoir toutes les clés
    return DOCUMENT_TYPES[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      expiring_soon: "secondary",
      expired: "destructive",
      archived: "outline",
    };
    // @ts-ignore
    const label = DOCUMENT_STATUS_LABELS[status] || status;
    return (
      <Badge variant={variants[status] || "outline"}>
        {label}
      </Badge>
    );
  };

  return (
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
        <Button asChild className="shadow-lg hover:shadow-xl transition-all duration-300">
          <Link href={ownerDocumentRoutes.upload()}>
            <Upload className="mr-2 h-4 w-4" />
            Téléverser un document
          </Link>
        </Button>
      </div>

      {/* Filtres */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, type ou adresse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
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
          <SelectTrigger>
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

      {/* Liste des documents */}
      {filteredDocuments.length === 0 ? (
        <EmptyStateDocuments />
      ) : (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bien</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc: any) => (
                    <tr
                      key={doc.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-slate-50 transition-colors duration-200 group"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 rounded text-blue-600">
                             <FileText className="h-4 w-4" />
                          </div>
                          <div>
                             <span className="font-medium text-slate-900 block">{doc.title || getTypeLabel(doc.type || "")}</span>
                             <span className="text-xs text-muted-foreground">{getTypeLabel(doc.type || "")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {doc.property?.adresse_complete || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {doc.created_at ? formatDateShort(doc.created_at) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-blue-50 hover:text-blue-700"
                          onClick={() => {
                            if (doc.storage_path) {
                              // TODO: Utiliser une route API signée pour le téléchargement sécurisé
                              // Pour l'instant on suppose que c'est une URL publique ou gérée ailleurs
                               window.open(doc.storage_path, "_blank");
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Télécharger</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyStateDocuments() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucun document pour l'instant</h2>
        <p className="text-muted-foreground mb-6">
          Tous vos documents (baux, EDL, diagnostics, quittances…) apparaîtront ici dès qu'ils
          seront générés ou téléversés.
        </p>
        <Button asChild>
          <Link href={ownerDocumentRoutes.upload()}>
            <Upload className="mr-2 h-4 w-4" />
            Téléverser un document
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

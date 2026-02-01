"use client";
// @ts-nocheck

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FolderOpen,
  Upload,
  FileText,
  Download,
  Eye,
  Calendar,
  Shield,
  AlertTriangle,
  File,
} from "lucide-react";

interface DocumentItem {
  id: string;
  type: string;
  title?: string;
  name?: string;
  storage_path: string;
  created_at: string;
  metadata?: any;
}

interface GedDocumentItem {
  id: string;
  document_type: string;
  title: string;
  file_path: string;
  status: string;
  expiry_date?: string | null;
  created_at: string;
  category: string;
}

interface DocumentsViewProps {
  leaseId: string;
  propertyId: string;
  documents: DocumentItem[];
  gedDocuments: GedDocumentItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
  legal: "Juridique",
  diagnostic: "Diagnostics",
  insurance: "Assurance",
  financial: "Financier",
  identity: "Identité",
  edl: "État des lieux",
  maintenance: "Entretien",
  other: "Autre",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  bail: "Contrat de bail",
  avenant: "Avenant",
  quittance: "Quittance de loyer",
  etat_des_lieux: "État des lieux",
  dpe: "DPE",
  diagnostic_gaz: "Diagnostic gaz",
  diagnostic_electricite: "Diagnostic électricité",
  attestation_assurance: "Attestation assurance",
  caution: "Acte de cautionnement",
  reglement_copro: "Règlement copropriété",
};

function getExpiryBadge(expiryDate: string | null | undefined) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return <Badge variant="destructive" className="text-[10px]">Expiré</Badge>;
  }
  if (daysUntil <= 30) {
    return <Badge className="bg-amber-100 text-amber-700 text-[10px]" variant="outline">Expire dans {daysUntil}j</Badge>;
  }
  return null;
}

export function DocumentsView({ leaseId, propertyId, documents, gedDocuments }: DocumentsViewProps) {
  const [filter, setFilter] = useState<string>("all");

  const allDocs = [
    ...documents.map((d) => ({
      id: d.id,
      title: d.title || d.name || d.type,
      type: d.type,
      category: "legal" as string,
      createdAt: d.created_at,
      storagePath: d.storage_path,
      expiryDate: null as string | null,
      source: "documents" as const,
    })),
    ...gedDocuments.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.document_type,
      category: d.category,
      createdAt: d.created_at,
      storagePath: d.file_path,
      expiryDate: d.expiry_date || null,
      source: "ged" as const,
    })),
  ];

  const categories = [...new Set(allDocs.map((d) => d.category))];

  const filteredDocs = filter === "all" ? allDocs : allDocs.filter((d) => d.category === filter);

  const expiringCount = allDocs.filter((d) => {
    if (!d.expiryDate) return false;
    const daysUntil = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents du bail</h2>
          <p className="text-sm text-muted-foreground">{allDocs.length} document{allDocs.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/owner/ged?lease_id=${leaseId}`}>
              <FolderOpen className="h-4 w-4 mr-2" />
              GED complète
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/owner/ged?action=upload&lease_id=${leaseId}&property_id=${propertyId}`}>
              <Upload className="h-4 w-4 mr-2" />
              Ajouter
            </Link>
          </Button>
        </div>
      </div>

      {/* Expiry alert */}
      {expiringCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {expiringCount} document{expiringCount > 1 ? "s" : ""} expire{expiringCount > 1 ? "nt" : ""} bientôt
              </p>
              <p className="text-xs text-amber-600">Pensez à renouveler les documents expirés ou arrivant à échéance.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {allDocs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun document"
          description="Ajoutez des documents à ce bail : contrat, diagnostics, attestations..."
          action={{
            label: "Ajouter un document",
            href: `/owner/ged?action=upload&lease_id=${leaseId}&property_id=${propertyId}`,
          }}
        />
      ) : (
        <>
          {/* Category filter */}
          {categories.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                Tous ({allDocs.length})
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={filter === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(cat)}
                >
                  {CATEGORY_LABELS[cat] || cat} ({allDocs.filter((d) => d.category === cat).length})
                </Button>
              ))}
            </div>
          )}

          {/* Documents grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredDocs.map((doc) => (
              <Card key={`${doc.source}-${doc.id}`} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                      <FileIcon type={doc.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {DOC_TYPE_LABELS[doc.type] || doc.type}
                          </p>
                        </div>
                        {getExpiryBadge(doc.expiryDate)}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                          <a
                            href={`/api/documents/view?path=${encodeURIComponent(doc.storagePath)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                          <a
                            href={`/api/documents/download?path=${encodeURIComponent(doc.storagePath)}&filename=${encodeURIComponent(doc.title || "document")}`}
                            download
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FileIcon({ type }: { type: string }) {
  if (type.includes("diagnostic") || type === "dpe") {
    return <Shield className="h-5 w-5 text-blue-600" />;
  }
  if (type.includes("assurance") || type === "attestation_assurance") {
    return <Shield className="h-5 w-5 text-green-600" />;
  }
  if (type === "bail" || type === "avenant") {
    return <FileText className="h-5 w-5 text-indigo-600" />;
  }
  if (type === "quittance") {
    return <Calendar className="h-5 w-5 text-emerald-600" />;
  }
  return <File className="h-5 w-5 text-slate-500" />;
}

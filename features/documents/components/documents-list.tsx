"use client";

import { useEffect, useState, useMemo } from "react";
import { DocumentCard } from "./document-card";
import { DocumentUploadForm } from "./document-upload-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import type { Document } from "@/lib/types";
import { useAuth } from "@/lib/hooks/use-auth";

/**
 * B6 fix: Groupe les documents CNI recto+verso en un seul élément
 * pour éviter l'affichage en double dans la liste.
 */
function groupCniDocuments(docs: Document[]): Document[] {
  const rectos = docs.filter((d) => d.type === "cni_recto");
  const versos = docs.filter((d) => d.type === "cni_verso");
  const others = docs.filter((d) => d.type !== "cni_recto" && d.type !== "cni_verso");

  const matchedVersoIds = new Set<string>();
  const grouped: Document[] = [];

  for (const recto of rectos) {
    // Trouver le verso correspondant (même bail ou même locataire)
    const verso = versos.find(
      (v) =>
        !matchedVersoIds.has(v.id) &&
        ((recto.lease_id && v.lease_id === recto.lease_id) ||
          (recto.tenant_id && v.tenant_id === recto.tenant_id))
    );

    if (verso) {
      matchedVersoIds.add(verso.id);
    }

    // Afficher le recto avec un titre groupé
    grouped.push({
      ...recto,
      title: recto.title || "Carte d'Identité (Recto" + (verso ? " + Verso" : "") + ")",
    });
  }

  // Versos orphelins (sans recto correspondant)
  for (const verso of versos) {
    if (!matchedVersoIds.has(verso.id)) {
      grouped.push({
        ...verso,
        title: verso.title || "Carte d'Identité (Verso)",
      });
    }
  }

  return [...others, ...grouped];
}

interface DocumentsListProps {
  propertyId?: string;
  leaseId?: string;
  showUpload?: boolean;
}

export function DocumentsList({ propertyId, leaseId, showUpload = true }: DocumentsListProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [propertyId, leaseId]);

  async function fetchDocuments() {
    try {
      setLoading(true);
      let data: Document[];

      if (leaseId) {
        data = await documentsService.getDocumentsByLease(leaseId);
      } else if (propertyId) {
        data = await documentsService.getDocumentsByProperty(propertyId);
      } else if (profile?.role === "owner" || profile?.role === "admin") {
        data = await documentsService.getDocumentsByOwner(profile.id);
      } else if (profile?.role === "tenant") {
        data = await documentsService.getDocumentsByTenant(profile.id);
      } else {
        data = [];
      }

      // B6 fix: Grouper les CNI recto/verso pour éviter les doublons visuels
      setDocuments(groupCniDocuments(data));
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les documents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement des documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Documents ({documents.length})</h2>
        {showUpload && !showUploadForm && (
          <Button onClick={() => setShowUploadForm(true)}>Ajouter un document</Button>
        )}
      </div>

      {showUploadForm && (
        <DocumentUploadForm
          propertyId={propertyId}
          leaseId={leaseId}
          onSuccess={() => {
            setShowUploadForm(false);
            fetchDocuments();
          }}
          onCancel={() => setShowUploadForm(false)}
        />
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun document enregistré.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} onDelete={fetchDocuments} />
          ))}
        </div>
      )}
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { DocumentCard } from "./document-card";
import { DocumentUploadForm } from "./document-upload-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import type { Document } from "@/lib/types";
import { useAuth } from "@/lib/hooks/use-auth";

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

      setDocuments(data);
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


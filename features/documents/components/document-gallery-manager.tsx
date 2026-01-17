"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import type { Document, DocumentType } from "@/lib/types";
import { Loader2, Upload, ImageIcon, FileText, ArrowUp, ArrowDown, Star, Trash2, AlertCircle } from "lucide-react";

interface DocumentGalleryManagerProps {
  propertyId: string;
  collection?: string;
  type?: DocumentType;
  title?: string;
  description?: string;
  accept?: string;
  maxFiles?: number;
  onChange?: (documents: Document[]) => void;
}

function isImageDocument(document: Document) {
  const preview = document.preview_url || document.storage_path || "";
  return preview.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) !== null;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 Ko";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} Ko`;
  return `${(kb / 1024).toFixed(1)} Mo`;
}

const DEFAULT_ACCEPT = "image/*,application/pdf";

export function DocumentGalleryManager({
  propertyId,
  collection = "property_media",
  type = "autre",
  title = "Galerie du logement",
  description = "Ajoutez et organisez vos photos et documents clés.",
  accept = DEFAULT_ACCEPT,
  maxFiles = 20,
  onChange,
}: DocumentGalleryManagerProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [advancedFeaturesEnabled, setAdvancedFeaturesEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedDocuments = useMemo(() => {
    return documents
      .slice()
      .sort((a, b) => {
        const posA = a.position ?? Number.MAX_SAFE_INTEGER;
        const posB = b.position ?? Number.MAX_SAFE_INTEGER;
        return posA - posB;
      });
  }, [documents]);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const docs = await documentsService.getDocumentsByProperty(propertyId, collection);
      setDocuments(docs);
      onChange?.(docs);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les documents.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [collection, onChange, propertyId, toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (files.length + documents.length > maxFiles) {
      toast({
        title: "Limite atteinte",
        description: `Vous pouvez ajouter au maximum ${maxFiles} fichiers.`,
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    setSelectedFiles(files);
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedFiles([]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Aucun fichier sélectionné",
        description: "Veuillez sélectionner un ou plusieurs fichiers à importer.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      await documentsService.uploadBatch({
        propertyId,
        collection,
        type,
        files: selectedFiles,
      });

      toast({
        title: "Documents ajoutés",
        description: `${selectedFiles.length} fichier(s) ont été uploadés avec succès.`,
      });

      resetFileInput();
      fetchDocuments();
    } catch (error: unknown) {
      toast({
        title: "Upload impossible",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'upload.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAdvancedFeatureError = (message?: string) => {
    const normalized = message?.toLowerCase() ?? "";
    if (normalized.includes("documents_gallery") || normalized.includes("migration")) {
      if (advancedFeaturesEnabled) {
        setAdvancedFeaturesEnabled(false);
      }
      toast({
        title: "Fonction non disponible",
        description: message ?? "Activez la migration documents_gallery pour utiliser le tri et la mise en avant.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  const handleMove = async (document: Document, direction: 1 | -1) => {
    if (!advancedFeaturesEnabled) {
      toast({
        title: "Tri indisponible",
        description: "Appliquez la migration documents_gallery pour activer cette action.",
        variant: "destructive",
      });
      return;
    }

    if (!document.position) return;
    const newPosition = document.position + direction;
    if (newPosition < 1) return;
    if (newPosition > documents.length) return;

    try {
      await documentsService.reorderDocument(document.id, newPosition);
      fetchDocuments();
    } catch (error: unknown) {
      if (handleAdvancedFeatureError(error?.message)) {
        return;
      }
      toast({
        title: "Réorganisation impossible",
        description: error?.message || "Une erreur est survenue lors du tri.",
        variant: "destructive",
      });
    }
  };

  const handleSetCover = async (document: Document) => {
    if (!advancedFeaturesEnabled) {
      toast({
        title: "Action indisponible",
        description: "Activez la migration documents_gallery pour mettre un document en avant.",
        variant: "destructive",
      });
      return;
    }

    try {
      await documentsService.setCover(document.id);
      fetchDocuments();
      toast({
        title: "Mise à jour",
        description: "Ce document est désormais mis en avant.",
      });
    } catch (error: unknown) {
      if (handleAdvancedFeatureError(error?.message)) {
        return;
      }
      toast({
        title: "Impossible de définir la couverture",
        description: error?.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (document: Document) => {
    if (!confirm("Voulez-vous vraiment supprimer ce document ?")) return;

    try {
      await documentsService.deleteDocument(document.id);
      fetchDocuments();
      toast({
        title: "Document supprimé",
        description: "Le fichier a été supprimé avec succès.",
      });
    } catch (error: unknown) {
      toast({
        title: "Suppression impossible",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept={accept}
                onChange={handleFileSelection}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                Ajouter des fichiers
              </Button>
            </div>
            {selectedFiles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.length} fichier(s) sélectionné(s)
                </span>
                <Button size="sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Upload...
                    </>
                  ) : (
                    "Uploader"
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={resetFileInput} disabled={uploading}>
                  Annuler
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!advancedFeaturesEnabled && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Tri et mise en avant désactivés. Appliquez la migration{" "}
              <span className="font-semibold">documents_gallery</span> pour réactiver ces actions.
            </p>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement des documents...
          </div>
        ) : sortedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed rounded-lg p-10 text-center text-muted-foreground">
            <Upload className="h-8 w-8 mb-3" />
            <p>Aucune donnée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDocuments.map((document, index) => {
              const isCover = document.is_cover;
              const position = document.position ?? index + 1;
              return (
                <div
                  key={document.id}
                  className="flex flex-col md:flex-row items-start gap-4 rounded-lg border p-4"
                >
                  <div className="relative rounded-md bg-muted overflow-hidden flex-shrink-0 w-full md:w-32 md:h-24">
                    {isImageDocument(document) && document.preview_url ? (
                      <Image
                        src={document.preview_url}
                        alt={document.title ?? "Document"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center text-muted-foreground">
                        <FileText className="h-10 w-10" />
                      </div>
                    )}
                    {isCover && (
                      <Badge variant="secondary" className="absolute top-2 left-2 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Mise en avant
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium leading-tight">
                          {document.title ?? "Document sans titre"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Position #{position} • ID: {document.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    {document.notes && (
                      <p className="text-sm text-muted-foreground">{document.notes}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {advancedFeaturesEnabled && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleMove(document, -1)}
                            disabled={position === 1 || uploading}
                          >
                            <ArrowUp className="h-4 w-4 mr-1" />
                            Monter
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleMove(document, 1)}
                            disabled={position === documents.length || uploading}
                          >
                            <ArrowDown className="h-4 w-4 mr-1" />
                            Descendre
                          </Button>
                          <Button
                            variant={isCover ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSetCover(document)}
                            disabled={isCover || uploading}
                          >
                            <Star className="h-4 w-4 mr-1" />
                            {isCover ? "Document principal" : "Mettre en avant"}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(document)}
                        disabled={uploading}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


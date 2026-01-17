"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { guarantorProfilesService } from "@/features/profiles/services/guarantor-profiles.service";
import type { GuarantorDocument, GuarantorDocumentType } from "@/lib/types/guarantor";
import {
  GUARANTOR_DOCUMENT_TYPE_LABELS,
  REQUIRED_GUARANTOR_DOCUMENTS,
  OPTIONAL_GUARANTOR_DOCUMENTS,
} from "@/lib/types/guarantor";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function GuarantorDocumentsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<GuarantorDocument[]>([]);
  const [selectedType, setSelectedType] = useState<GuarantorDocumentType | "">("");

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await guarantorProfilesService.getDocuments();
      setDocuments(docs);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les documents",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedType) return;

    // Validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: "La taille maximum est de 10 MB",
      });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Type de fichier non autorisé",
        description: "Formats acceptés : PDF, JPEG, PNG, WebP",
      });
      return;
    }

    setUploading(true);
    try {
      await guarantorProfilesService.uploadDocument(file, selectedType);
      toast({
        title: "Document uploadé",
        description: "Votre document a été ajouté avec succès.",
      });
      setSelectedType("");
      await loadDocuments();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setUploading(false);
      // Reset l'input
      event.target.value = "";
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;

    try {
      await guarantorProfilesService.deleteDocument(documentId);
      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé.",
      });
      await loadDocuments();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer le document",
      });
    }
  };

  // Calculer la progression
  const providedTypes = new Set(documents.map((d) => d.document_type));
  const requiredProvided = REQUIRED_GUARANTOR_DOCUMENTS.filter((t) =>
    providedTypes.has(t)
  ).length;
  const progressPercent = (requiredProvided / REQUIRED_GUARANTOR_DOCUMENTS.length) * 100;

  // Documents disponibles pour upload (non encore fournis)
  const availableTypes = [...REQUIRED_GUARANTOR_DOCUMENTS, ...OPTIONAL_GUARANTOR_DOCUMENTS]
    .filter((type) => !providedTypes.has(type) || type === "autre");

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes documents</h1>
        <p className="text-muted-foreground">
          Téléchargez les justificatifs nécessaires pour valider votre profil garant
        </p>
      </div>

      {/* Progression */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Complétude du dossier</CardTitle>
            <Badge variant={progressPercent === 100 ? "default" : "secondary"}>
              {requiredProvided}/{REQUIRED_GUARANTOR_DOCUMENTS.length} requis
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          {progressPercent < 100 && (
            <p className="text-sm text-muted-foreground">
              Documents requis manquants :{" "}
              {REQUIRED_GUARANTOR_DOCUMENTS.filter((t) => !providedTypes.has(t))
                .map((t) => GUARANTOR_DOCUMENT_TYPE_LABELS[t])
                .join(", ")}
            </p>
          )}
          {progressPercent === 100 && (
            <div className="flex items-center text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Tous les documents requis ont été fournis
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajouter un document</CardTitle>
          <CardDescription>
            Formats acceptés : PDF, JPEG, PNG, WebP (max 10 MB)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select
              value={selectedType}
              onValueChange={(value) =>
                setSelectedType(value as GuarantorDocumentType)
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Type de document..." />
              </SelectTrigger>
              <SelectContent>
                <div className="py-1 px-2 text-xs font-semibold text-muted-foreground">
                  Documents requis
                </div>
                {REQUIRED_GUARANTOR_DOCUMENTS.filter(
                  (t) => !providedTypes.has(t)
                ).map((type) => (
                  <SelectItem key={type} value={type}>
                    {GUARANTOR_DOCUMENT_TYPE_LABELS[type]} *
                  </SelectItem>
                ))}
                <div className="py-1 px-2 text-xs font-semibold text-muted-foreground mt-2">
                  Documents optionnels
                </div>
                {OPTIONAL_GUARANTOR_DOCUMENTS.filter(
                  (t) => !providedTypes.has(t)
                ).map((type) => (
                  <SelectItem key={type} value={type}>
                    {GUARANTOR_DOCUMENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
                {providedTypes.size > 0 && (
                  <SelectItem value="autre">Autre document</SelectItem>
                )}
              </SelectContent>
            </Select>

            <div className="relative">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileUpload}
                disabled={!selectedType || uploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <Button disabled={!selectedType || uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choisir le fichier
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents fournis</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aucun document téléchargé pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        doc.is_verified
                          ? "bg-green-100"
                          : doc.rejection_reason
                          ? "bg-red-100"
                          : "bg-yellow-100"
                      }`}
                    >
                      {doc.is_verified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : doc.rejection_reason ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {GUARANTOR_DOCUMENT_TYPE_LABELS[doc.document_type]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {doc.original_filename}
                        {doc.file_size && ` • ${formatFileSize(doc.file_size)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ajouté le {formatDate(doc.created_at)}
                      </p>
                      {doc.rejection_reason && (
                        <p className="text-sm text-red-600 mt-1">
                          Rejeté : {doc.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        doc.is_verified
                          ? "default"
                          : doc.rejection_reason
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {doc.is_verified
                        ? "Vérifié"
                        : doc.rejection_reason
                        ? "Rejeté"
                        : "En attente"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Vos documents seront vérifiés par le propriétaire ou un administrateur.
          Une fois tous les documents requis validés, vous pourrez vous porter caution.
        </AlertDescription>
      </Alert>
    </div>
  );
}








"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
} from "lucide-react";
import {
  LEASE_DOCUMENT_TYPES,
  type LeaseDocumentTypeConfig,
} from "@/lib/config/lease-document-types";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseId: string;
  propertyId: string;
  /** Pré-sélectionner un type (utile pour le remplacement) */
  preselectedType?: string;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

export function DocumentUploadDialog({
  open,
  onOpenChange,
  leaseId,
  propertyId,
  preselectedType,
}: DocumentUploadDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedType, setSelectedType] = useState<string>(
    preselectedType || ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setSelectedType(preselectedType || "");
    setUploading(false);
  }, [preselectedType]);

  const handleFileSelect = useCallback(
    (f: File) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast({
          title: "Format non supporté",
          description: "Seuls les PDF, JPG, PNG et WebP sont acceptés.",
          variant: "destructive",
        });
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale est de 10 Mo.",
          variant: "destructive",
        });
        return;
      }
      setFile(f);
    },
    [toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!file || !selectedType) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", selectedType);
      formData.append("lease_id", leaseId);
      formData.append("property_id", propertyId);

      // apiClient.uploadFile : CSRF + cookies + check response.ok intégrés
      await apiClient.uploadFile<any>("/documents/upload", formData);

      toast({
        title: "Document ajouté",
        description: `Le document a été ajouté avec succès.`,
      });
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'uploader le document.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Types disponibles pour un bail
  const availableTypes = LEASE_DOCUMENT_TYPES.filter(
    (t) => t.type !== "bail" && t.type !== "EDL_entree" && t.type !== "EDL_sortie"
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Type de document
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {availableTypes.map((config) => (
                <button
                  key={config.type}
                  onClick={() => setSelectedType(config.type)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    selectedType === config.type
                      ? "border-blue-300 bg-blue-50 text-blue-700 font-semibold dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                      : "border-border text-muted-foreground hover:border-border hover:bg-muted"
                  }`}
                >
                  {config.label}
                  {config.required && (
                    <span className="text-orange-500 ml-1">*</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Dropzone */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Fichier
            </label>
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/20"
                    : "border-border hover:border-border hover:bg-muted"
                }`}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Glissez un fichier ici ou{" "}
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    cliquez pour parcourir
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG · 10 Mo max
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-950/20 dark:border-green-900">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} Mo
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || !selectedType || uploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Ajouter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

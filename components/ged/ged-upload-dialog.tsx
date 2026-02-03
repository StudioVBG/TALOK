"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGedUpload, useGedDocumentTypes } from "@/lib/hooks/use-ged-documents";
import { DOCUMENT_TYPES } from "@/lib/owner/constants";
import type { DocumentType } from "@/lib/types/index";
import type { GedUploadInput } from "@/lib/types/ged";

interface GedUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: DocumentType;
  defaultPropertyId?: string | null;
  defaultLeaseId?: string | null;
  defaultEntityId?: string | null;
  properties?: Array<{ id: string; adresse_complete: string; ville: string }>;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];

export function GedUploadDialog({
  open,
  onOpenChange,
  defaultType,
  defaultPropertyId,
  defaultLeaseId,
  defaultEntityId,
  properties,
}: GedUploadDialogProps) {
  const { toast } = useToast();
  const uploadMutation = useGedUpload();

  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>(defaultType || "autre");
  const [title, setTitle] = useState("");
  const [propertyId, setPropertyId] = useState<string>(defaultPropertyId || "");
  const [validUntil, setValidUntil] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const resetForm = useCallback(() => {
    setFile(null);
    setDocType(defaultType || "autre");
    setTitle("");
    setPropertyId(defaultPropertyId || "");
    setValidUntil("");
  }, [defaultType, defaultPropertyId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10 Mo.",
        variant: "destructive",
      });
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast({
        title: "Format non supporté",
        description: "Formats acceptés : PDF, JPG, PNG, WebP.",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
    // Auto-set title from filename if empty
    if (!title) {
      const name = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({ title: "Aucun fichier sélectionné", variant: "destructive" });
      return;
    }

    const input: GedUploadInput = {
      file,
      type: docType as DocumentType,
      title: title || undefined,
      property_id: propertyId || defaultPropertyId || null,
      lease_id: defaultLeaseId || null,
      entity_id: defaultEntityId || null,
      valid_until: validUntil || null,
    };

    uploadMutation.mutate(input, {
      onSuccess: () => {
        toast({ title: "Document uploadé" });
        resetForm();
        onOpenChange(false);
      },
      onError: (error) => {
        toast({
          title: "Erreur d'upload",
          description: error instanceof Error ? error.message : "Une erreur est survenue",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription>
            Uploadez un document et renseignez ses métadonnées GED.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              file && "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById("ged-file-input")?.click()}
          >
            <input
              id="ged-file-input"
              type="file"
              className="hidden"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileChange}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[300px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} Ko
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Glissez un fichier ici ou cliquez pour parcourir
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG - Max 10 Mo
                </p>
              </>
            )}
          </div>

          {/* Type de document */}
          <div className="space-y-2">
            <Label htmlFor="doc-type">Type de document</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger id="doc-type">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="doc-title">Titre (optionnel)</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: DPE appartement Paris 11e"
            />
          </div>

          {/* Bien rattaché */}
          {properties && properties.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="doc-property">Bien rattaché</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger id="doc-property">
                  <SelectValue placeholder="Sélectionner un bien (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun bien</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.adresse_complete} - {p.ville}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date d'expiration */}
          <div className="space-y-2">
            <Label htmlFor="doc-expiry">Date d'expiration (optionnel)</Label>
            <Input
              id="doc-expiry"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || uploadMutation.isPending}
            className="gap-2"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Ajouter
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

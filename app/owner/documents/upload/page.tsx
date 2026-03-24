"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, ArrowLeft, FileText, X, File, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { ownerDocumentRoutes, ownerPropertyRoutes, ownerContractRoutes } from "@/lib/owner/routes";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function OwnerDocumentsUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const propertyId = searchParams.get("property_id");
  const leaseId = searchParams.get("lease_id");

  // Formats acceptés
  const acceptedFormats = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "webp"];
    
    if (!extension || !validExtensions.includes(extension)) {
      return `Format non supporté: ${extension}. Formats acceptés: PDF, DOC, DOCX, JPG, PNG, WEBP`;
    }
    
    if (file.size > maxFileSize) {
      return `Fichier trop volumineux: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 10MB`;
    }
    
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: File[] = [];
    
    fileArray.forEach(file => {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Fichier invalide",
          description: error,
          variant: "destructive",
        });
      } else if (!files.some(f => f.name === file.name && f.size === file.size)) {
        validFiles.push(file);
      }
    });
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  }, [files, toast]);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (files.length === 0 || !type) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un fichier et un type de document",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    
    try {
      const totalFiles = files.length;
      let uploadedCount = 0;
      
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        if (propertyId) formData.append("property_id", propertyId);
        if (leaseId) formData.append("lease_id", leaseId);

        await apiClient.uploadFile("/documents/upload", formData);
        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      toast({
        title: "Succès",
        description: `${totalFiles} document${totalFiles > 1 ? "s" : ""} téléversé${totalFiles > 1 ? "s" : ""} avec succès`,
      });

      // Rediriger vers la liste des documents
      const redirectUrl = propertyId
        ? ownerDocumentRoutes.withFilter({ property_id: propertyId })
        : leaseId
        ? ownerDocumentRoutes.withFilter({ lease_id: leaseId })
        : ownerDocumentRoutes.list();
      router.push(redirectUrl);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du téléversement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={ownerDocumentRoutes.list()}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
            Téléverser un document
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Ajoutez un nouveau document à votre bibliothèque
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle>Téléverser des documents</CardTitle>
          <CardDescription>
            Glissez-déposez vos fichiers ou cliquez pour parcourir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Zone Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-4 sm:p-6 md:p-8 transition-all duration-200 cursor-pointer",
              "hover:border-indigo-400 hover:bg-indigo-50/50",
              isDragOver 
                ? "border-indigo-500 bg-indigo-50 scale-[1.02]" 
                : "border-border bg-muted/50"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              accept={acceptedFormats}
              className="hidden"
            />
            
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className={cn(
                "p-4 rounded-full transition-colors",
                isDragOver ? "bg-indigo-100" : "bg-muted"
              )}>
                <Upload className={cn(
                  "h-10 w-10 transition-colors",
                  isDragOver ? "text-indigo-600" : "text-muted-foreground"
                )} />
              </div>
              
              <div>
                <p className="text-lg font-medium text-foreground">
                  {isDragOver ? "Relâchez pour ajouter" : "Glissez vos fichiers ici"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ou <span className="text-indigo-600 font-medium">parcourez</span> pour sélectionner
                </p>
              </div>
              
              <p className="text-xs text-muted-foreground">
                PDF, DOC, DOCX, JPG, PNG, WEBP • Max 10MB par fichier
              </p>
            </div>
          </div>

          {/* Liste des fichiers sélectionnés */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <File className="h-4 w-4" />
                {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((file, index) => (
                  <div 
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <FileText className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Type de document */}
          <div className="space-y-2">
            <Label htmlFor="type">Type de document</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bail">📄 Bail</SelectItem>
                <SelectItem value="avenant">📝 Avenant</SelectItem>
                <SelectItem value="EDL_entree">📋 État des lieux d'entrée</SelectItem>
                <SelectItem value="EDL_sortie">📋 État des lieux de sortie</SelectItem>
                <SelectItem value="quittance">💰 Quittance de loyer</SelectItem>
                <SelectItem value="attestation_assurance">🛡️ Attestation d'assurance</SelectItem>
                <SelectItem value="dpe">🔍 DPE</SelectItem>
                <SelectItem value="diagnostic_gaz">🔥 Diagnostic gaz</SelectItem>
                <SelectItem value="diagnostic_electricite">⚡ Diagnostic électricité</SelectItem>
                <SelectItem value="diagnostic_plomb">🧪 Diagnostic plomb</SelectItem>
                <SelectItem value="piece_identite">👤 Pièce d'identité</SelectItem>
                <SelectItem value="justificatif_domicile">🏠 Justificatif de domicile</SelectItem>
                <SelectItem value="facture">🧾 Facture</SelectItem>
                <SelectItem value="photo">📸 Photo</SelectItem>
                <SelectItem value="autres">📁 Autres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Barre de progression */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Téléversement en cours...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-4">
            <Button 
              onClick={handleUpload} 
              disabled={loading || files.length === 0 || !type}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Téléversement...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Téléverser {files.length > 0 && `(${files.length})`}
                </>
              )}
            </Button>
            <Button variant="outline" asChild disabled={loading}>
              <Link href={ownerDocumentRoutes.list()}>Annuler</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


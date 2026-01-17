"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useCreateDocument } from "@/lib/hooks/use-documents";
import { typedSupabaseClient } from "@/lib/supabase/typed-client";
import { useAuth } from "@/lib/hooks/use-auth";

interface DocumentUploadModalProps {
  leaseId?: string;
  propertyId?: string;
}

const DOCUMENT_TYPES = [
  { value: "attestation_assurance", label: "Attestation d'assurance" },
  { value: "cni", label: "Pièce d'identité" },
  { value: "justificatif_domicile", label: "Justificatif de domicile" },
  { value: "rib", label: "RIB" },
  { value: "autre", label: "Autre document" },
];

export function DocumentUploadModal({ leaseId, propertyId }: DocumentUploadModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<string>("attestation_assurance");
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const createDocument = useCreateDocument();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale autorisée est de 10 Mo.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.split(".")[0]);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !profile) return;

    try {
      setIsUploading(true);

      // 1. Upload vers le bucket 'documents'
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `tenants/${profile.id}/${type}/${fileName}`;

      const { data: uploadData, error: uploadError } = await typedSupabaseClient.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Créer l'entrée en BDD
      await createDocument.mutateAsync({
        title: title || file.name,
        type,
        storage_path: filePath,
        lease_id: leaseId || null,
        property_id: propertyId || null,
        tenant_id: profile.id,
        metadata: {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          uploaded_at: new Date().toISOString(),
        },
      });

      toast({
        title: "Document envoyé",
        description: "Votre document a été ajouté avec succès.",
      });

      setOpen(false);
      resetForm();
    } catch (error: unknown) {
      console.error("Erreur upload:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le document.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setType("attestation_assurance");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
          <Upload className="h-4 w-4" />
          Ajouter un document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="doc-type">Type de document</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="doc-type">
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-title">Nom du document (optionnel)</Label>
            <Input 
              id="doc-title" 
              placeholder="Ex: Attestation assurance 2025" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-file">Fichier (PDF, JPG, PNG - max 10 Mo)</Label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 transition-colors bg-slate-50/50">
              {file ? (
                <div className="text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-2" />
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 text-red-600 hover:text-red-700 h-7"
                    onClick={() => setFile(null)}
                  >
                    Changer de fichier
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-400" />
                  <div className="flex text-sm text-slate-600">
                    <label
                      htmlFor="doc-file"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                    >
                      <span>Sélectionner un fichier</span>
                      <input 
                        id="doc-file" 
                        name="doc-file" 
                        type="file" 
                        className="sr-only" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">ou glissez-déposez ici</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isUploading}>
            Annuler
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || isUploading}
            className="min-w-[120px] bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envoi...
              </>
            ) : (
              "Envoyer"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


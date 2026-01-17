"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { documentsService } from "../services/documents.service";
import type { DocumentType } from "@/lib/types";

interface DocumentUploadFormProps {
  propertyId?: string;
  leaseId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DocumentUploadForm({
  propertyId,
  leaseId,
  onSuccess,
  onCancel,
}: DocumentUploadFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    type: DocumentType;
    file: File | null;
  }>({
    type: "autre",
    file: null,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier la taille (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "Le fichier ne doit pas dépasser 10MB.",
          variant: "destructive",
        });
        return;
      }
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file) {
      toast({
        title: "Fichier requis",
        description: "Veuillez sélectionner un fichier.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await documentsService.uploadDocument({
        type: formData.type,
        property_id: propertyId || null,
        lease_id: leaseId || null,
        file: formData.file,
      });
      toast({
        title: "Document uploadé",
        description: "Le document a été uploadé avec succès.",
      });
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'upload.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploader un document</CardTitle>
        <CardDescription>Ajoutez un document (PDF, images, etc.)</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de document</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as DocumentType })
              }
              required
              disabled={loading}
            >
              <option value="bail">Bail</option>
              <option value="EDL_entree">État des lieux d'entrée</option>
              <option value="EDL_sortie">État des lieux de sortie</option>
              <option value="quittance">Quittance de loyer</option>
              <option value="attestation_assurance">Attestation d'assurance</option>
              <option value="attestation_loyer">Attestation de loyer</option>
              <option value="justificatif_revenus">Justificatif de revenus</option>
              <option value="piece_identite">Pièce d'identité</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Fichier (max 10MB)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
              required
              disabled={loading}
            />
            {formData.file && (
              <p className="text-sm text-muted-foreground">
                Fichier sélectionné : {formData.file.name} ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading || !formData.file}>
              {loading ? "Upload en cours..." : "Uploader"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


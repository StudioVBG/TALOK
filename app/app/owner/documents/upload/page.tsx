"use client";

import { useState } from "react";
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
import { Upload, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { ownerDocumentRoutes, ownerPropertyRoutes, ownerContractRoutes } from "@/lib/owner/routes";

export default function OwnerDocumentsUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const propertyId = searchParams.get("property_id");
  const leaseId = searchParams.get("lease_id");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !type) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier et un type de document",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      if (propertyId) formData.append("property_id", propertyId);
      if (leaseId) formData.append("lease_id", leaseId);

      await apiClient.uploadFile("/documents/upload", formData);

      toast({
        title: "Succès",
        description: "Document téléversé avec succès",
      });

      // Rediriger vers la liste des documents
      const redirectUrl = propertyId
        ? ownerDocumentRoutes.withFilter({ property_id: propertyId })
        : leaseId
        ? ownerDocumentRoutes.withFilter({ lease_id: leaseId })
        : ownerDocumentRoutes.list();
      router.push(redirectUrl);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du téléversement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          <CardTitle>Téléverser un document</CardTitle>
          <CardDescription>
            Sélectionnez un fichier et renseignez les informations nécessaires
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="file">Fichier</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {file.name}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type de document</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bail">Bail</SelectItem>
                <SelectItem value="avenant">Avenant</SelectItem>
                <SelectItem value="EDL_entree">État des lieux d'entrée</SelectItem>
                <SelectItem value="EDL_sortie">État des lieux de sortie</SelectItem>
                <SelectItem value="quittance">Quittance de loyer</SelectItem>
                <SelectItem value="attestation_assurance">Attestation d'assurance</SelectItem>
                <SelectItem value="diagnostic">Diagnostic</SelectItem>
                <SelectItem value="consentement">Consentement</SelectItem>
                <SelectItem value="taxe_sejour">Taxe de séjour</SelectItem>
                <SelectItem value="rapport_charges">Rapport de charges</SelectItem>
                <SelectItem value="autres">Autres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleUpload} disabled={loading || !file || !type}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Téléversement..." : "Téléverser"}
            </Button>
            <Button variant="outline" asChild>
              <Link href={ownerDocumentRoutes.list()}>Annuler</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


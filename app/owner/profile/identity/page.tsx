"use client";

import { useState, useEffect, useCallback } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { 
  Loader2, 
  Shield, 
  Upload, 
  CheckCircle2, 
  ArrowLeft,
  FileImage,
  Eye,
  Trash2,
  AlertCircle,
  CreditCard
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import Image from "next/image";
import { DocumentScan } from "@/features/identity-verification/components/document-scan";

interface IdentityDocument {
  id: string;
  type: string;
  storage_path: string;
  metadata: {
    side?: "recto" | "verso";
    filename?: string;
  };
  created_at: string;
}

export default function OwnerIdentityPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"recto" | "verso" | null>(null);
  const [isScanning, setIsScanning] = useState<"recto" | "verso" | null>(null);
  const [documents, setDocuments] = useState<{
    recto: IdentityDocument | null;
    verso: IdentityDocument | null;
  }>({
    recto: null,
    verso: null,
  });
  const [previewUrls, setPreviewUrls] = useState<{
    recto: string | null;
    verso: string | null;
  }>({
    recto: null,
    verso: null,
  });

  // Helper: fetch signed URL via server-side API route (same pattern as GED & Documents pages)
  const fetchSignedUrl = async (documentId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/documents/${documentId}/signed-url`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.signedUrl || null;
    } catch {
      return null;
    }
  };

  const loadDocuments = useCallback(async () => {
    if (!user) return;

    try {
      // Récupérer les documents d'identité via API sécurisée
      const { documents: docs } = await apiClient.get<{ documents: IdentityDocument[] }>("/owner/identity/documents");

      if (docs && docs.length > 0) {
        const recto = docs.find((d) =>
          d.type === "cni_recto" || d.metadata?.side === "recto"
        );
        const verso = docs.find((d) =>
          d.type === "cni_verso" || d.metadata?.side === "verso"
        );

        setDocuments({
          recto: recto || null,
          verso: verso || null,
        });

        // Générer les URLs signées via l'API route server-side
        if (recto?.id) {
          const url = await fetchSignedUrl(recto.id);
          if (url) setPreviewUrls(prev => ({ ...prev, recto: url }));
        }
        if (verso?.id) {
          const url = await fetchSignedUrl(verso.id);
          if (url) setPreviewUrls(prev => ({ ...prev, verso: url }));
        }
      }
    } catch (error) {
      console.error("Erreur chargement documents:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (side: "recto" | "verso", file: File) => {
    if (!user || !file) return;

    setUploading(side);

    try {
      // Supprimer l'ancien document si existant via API
      const oldDoc = documents[side];
      if (oldDoc) {
        await apiClient.delete(`/documents/${oldDoc.id}`);
      }

      // Upload via API sécurisée (FormData)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", side === "recto" ? "cni_recto" : "cni_verso");

      const { createClient: createSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur upload" }));
        throw new Error(err.error || `Erreur ${res.status}`);
      }

      const { document: newDoc } = await res.json();

      setDocuments(prev => ({ ...prev, [side]: newDoc }));

      // Générer l'URL signée via l'API route server-side
      if (newDoc?.id) {
        const url = await fetchSignedUrl(newDoc.id);
        if (url) setPreviewUrls(prev => ({ ...prev, [side]: url }));
      }

      toast({
        title: "Document uploade",
        description: `CNI ${side === "recto" ? "recto" : "verso"} enregistree avec succes.`,
      });
    } catch (error: unknown) {
      console.error("Erreur upload:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Impossible d'uploader le document.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (side: "recto" | "verso") => {
    const doc = documents[side];
    if (!doc) return;

    try {
      // Supprimer via API sécurisée (gère table + storage)
      await apiClient.delete(`/documents/${doc.id}`);

      setDocuments(prev => ({ ...prev, [side]: null }));
      setPreviewUrls(prev => ({ ...prev, [side]: null }));

      toast({
        title: "Document supprime",
        description: `CNI ${side === "recto" ? "recto" : "verso"} supprimee.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document.",
        variant: "destructive",
      });
    }
  };

  const UploadCard = ({ 
    side, 
    title, 
    description 
  }: { 
    side: "recto" | "verso"; 
    title: string; 
    description: string;
  }) => {
    const doc = documents[side];
    const previewUrl = previewUrls[side];
    const isUploading = uploading === side;

    if (isScanning === side) {
      return (
        <div className="fixed inset-0 z-50 bg-black">
          <DocumentScan
            documentType="cni"
            side={side}
            onCapture={(blob) => {
              const file = new File([blob], `cni_${side}.jpg`, { type: "image/jpeg" });
              handleUpload(side, file);
              setIsScanning(null);
            }}
            onBack={() => setIsScanning(null)}
          />
        </div>
      );
    }

    return (
      <Card className={doc ? "border-green-200 bg-green-50/30" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {doc ? (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-slate-500" />
                </div>
              )}
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </div>
            </div>
            {doc && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(side)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {previewUrl ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative aspect-[3/2] rounded-lg overflow-hidden border bg-white"
              >
                <Image
                  src={previewUrl}
                  alt={`CNI ${side}`}
                  fill
                  className="object-contain"
                />
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2"
                    onClick={() => window.open(previewUrl, "_blank")}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Voir
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="outline"
                    className="h-24 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 group transition-all"
                    onClick={() => setIsScanning(side)}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100">
                      <FileImage className="h-5 w-5 text-slate-500 group-hover:text-blue-600" />
                    </div>
                    <span className="text-xs font-medium">Prendre une photo</span>
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white px-2 text-muted-foreground">Ou uploader un fichier</span>
                    </div>
                  </div>

                  <Label
                    htmlFor={`file-${side}`}
                    className={`
                      flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-lg
                      cursor-pointer transition-all
                      ${isUploading 
                        ? "border-blue-300 bg-blue-50" 
                        : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                      }
                    `}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                        <span className="text-[10px] text-blue-600">Upload...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4">
                        <Upload className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-700">
                          Choisir un fichier
                        </span>
                      </div>
                    )}
                  </Label>
                </div>
                
                <p className="text-[10px] text-center text-muted-foreground">
                  JPG, PNG ou PDF • Max 10 Mo
                </p>

                <Input
                  id={`file-${side}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  capture="environment"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast({
                          title: "Fichier trop volumineux",
                          description: "La taille maximum est de 10 Mo.",
                          variant: "destructive",
                        });
                        return;
                      }
                      handleUpload(side, file);
                    }
                    e.target.value = "";
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  const isComplete = documents.recto && documents.verso;

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/owner/profile">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              Pièce d'identité
            </h1>
            <p className="text-muted-foreground">
              Vérifiez votre identité pour sécuriser vos transactions
            </p>
          </div>
        </div>

        {/* Statut */}
        <Card className={isComplete 
          ? "bg-green-50 border-green-200" 
          : "bg-amber-50 border-amber-200"
        }>
          <CardContent className="flex items-start gap-3 py-4">
            {isComplete ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Identité vérifiée</p>
                  <p className="text-sm text-green-700">
                    Votre pièce d'identité est complète (recto + verso).
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Vérification incomplète</p>
                  <p className="text-sm text-amber-700">
                    Veuillez uploader les deux faces de votre pièce d'identité.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Upload Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <UploadCard
            side="recto"
            title="CNI Recto"
            description="Face avant de votre carte d'identité"
          />
          <UploadCard
            side="verso"
            title="CNI Verso"
            description="Face arrière de votre carte d'identité"
          />
        </div>

        {/* Info */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="py-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Documents acceptés
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Carte nationale d'identité française (recto/verso)</li>
              <li>Passeport français ou européen</li>
              <li>Titre de séjour en cours de validité</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 border-t pt-3">
              🔒 Vos documents sont stockés de manière sécurisée et ne sont accessibles que par vous et les personnes autorisées.
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/owner/profile">Retour au profil</Link>
          </Button>
          {isComplete && (
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <Link href="/owner/dashboard">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Terminé
              </Link>
            </Button>
          )}
        </div>
      </motion.div>
    </ProtectedRoute>
  );
}




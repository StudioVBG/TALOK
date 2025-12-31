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
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/use-auth";
import Image from "next/image";

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

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    
    try {
      const supabase = createClient();
      
      // Récupérer le profile_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      // Récupérer les documents d'identité du propriétaire
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("owner_id", profile.id)
        .in("type", ["piece_identite", "cni_recto", "cni_verso"])
        .order("created_at", { ascending: false });

      if (docs && docs.length > 0) {
        const recto = docs.find((d: any) => 
          d.type === "cni_recto" || d.metadata?.side === "recto"
        );
        const verso = docs.find((d: any) => 
          d.type === "cni_verso" || d.metadata?.side === "verso"
        );
        
        setDocuments({
          recto: recto || null,
          verso: verso || null,
        });

        // Générer les URLs signées pour l'aperçu
        if (recto?.storage_path) {
          const { data: signedRecto } = await supabase.storage
            .from("documents")
            .createSignedUrl(recto.storage_path, 3600);
          if (signedRecto) {
            setPreviewUrls(prev => ({ ...prev, recto: signedRecto.signedUrl }));
          }
        }
        if (verso?.storage_path) {
          const { data: signedVerso } = await supabase.storage
            .from("documents")
            .createSignedUrl(verso.storage_path, 3600);
          if (signedVerso) {
            setPreviewUrls(prev => ({ ...prev, verso: signedVerso.signedUrl }));
          }
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
      const supabase = createClient();
      
      // Récupérer le profile_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profil non trouvé");

      // Générer un nom de fichier unique
      const ext = file.name.split(".").pop();
      const filename = `owner_cni_${side}_${profile.id}_${Date.now()}.${ext}`;
      const storagePath = `identity/${profile.id}/${filename}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Supprimer l'ancien document si existant
      const oldDoc = documents[side];
      if (oldDoc) {
        await supabase.from("documents").delete().eq("id", oldDoc.id);
        if (oldDoc.storage_path) {
          await supabase.storage.from("documents").remove([oldDoc.storage_path]);
        }
      }

      // Créer l'entrée dans la table documents
      const { data: newDoc, error: docError } = await supabase
        .from("documents")
        .insert({
          type: side === "recto" ? "cni_recto" : "cni_verso",
          owner_id: profile.id,
          tenant_id: null,
          property_id: null,
          lease_id: null,
          storage_path: storagePath,
          metadata: {
            side,
            filename: file.name,
            mime_type: file.type,
            size: file.size,
            uploaded_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (docError) throw docError;

      // Générer l'URL signée pour l'aperçu
      const { data: signedUrl } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 3600);

      setDocuments(prev => ({ ...prev, [side]: newDoc }));
      if (signedUrl) {
        setPreviewUrls(prev => ({ ...prev, [side]: signedUrl.signedUrl }));
      }

      toast({
        title: "✅ Document uploadé",
        description: `CNI ${side === "recto" ? "recto" : "verso"} enregistrée avec succès.`,
      });
    } catch (error: any) {
      console.error("Erreur upload:", error);
      toast({
        title: "Erreur d'upload",
        description: error.message || "Impossible d'uploader le document.",
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
      const supabase = createClient();

      // Supprimer de la table
      await supabase.from("documents").delete().eq("id", doc.id);

      // Supprimer du storage
      if (doc.storage_path) {
        await supabase.storage.from("documents").remove([doc.storage_path]);
      }

      setDocuments(prev => ({ ...prev, [side]: null }));
      setPreviewUrls(prev => ({ ...prev, [side]: null }));

      toast({
        title: "Document supprimé",
        description: `CNI ${side === "recto" ? "recto" : "verso"} supprimée.`,
      });
    } catch (error: any) {
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
              >
                <Label
                  htmlFor={`file-${side}`}
                  className={`
                    flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg
                    cursor-pointer transition-all
                    ${isUploading 
                      ? "border-blue-300 bg-blue-50" 
                      : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                    }
                  `}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <span className="text-sm text-blue-600">Upload en cours...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center px-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Upload className="h-6 w-6 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Cliquez pour uploader
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          JPG, PNG ou PDF • Max 10 Mo
                        </p>
                      </div>
                    </div>
                  )}
                </Label>
                <Input
                  id={`file-${side}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
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
        className="max-w-3xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/owner/profile">
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
            <Link href="/app/owner/profile">Retour au profil</Link>
          </Button>
          {isComplete && (
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <Link href="/app/owner/dashboard">
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




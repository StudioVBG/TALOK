"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

export function ProviderLogoCard() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/provider/settings/logo", {
          credentials: "include",
        });
        if (!res.ok) {
          setLogoUrl(null);
          return;
        }
        const json = await res.json();
        if (!cancelled) setLogoUrl(json.company_logo_url ?? null);
      } catch {
        if (!cancelled) setLogoUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Formats acceptés : JPEG, PNG, WebP, SVG",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Fichier trop volumineux",
        description: `Le logo ne doit pas dépasser ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/provider/settings/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erreur d'upload");
      }
      setLogoUrl(json.company_logo_url ?? null);
      toast({
        title: "Logo mis à jour",
        description: "Votre logo entreprise a été enregistré.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer le logo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!logoUrl) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/provider/settings/logo", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Erreur suppression");
      }
      setLogoUrl(null);
      toast({ title: "Logo supprimé" });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le logo.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-orange-500" />
          Logo entreprise
        </CardTitle>
        <CardDescription>
          Affiché sur vos devis, factures et votre fiche prestataire. JPEG, PNG, WebP ou SVG · 2 MB max.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="relative h-28 w-28 shrink-0 rounded-xl border border-dashed border-border bg-muted/40 overflow-hidden flex items-center justify-center">
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : logoUrl ? (
              // Logo affiché en preview — image distante via Next/Image
              <Image
                src={logoUrl}
                alt="Logo entreprise"
                fill
                sizes="112px"
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || deleting}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {logoUrl ? "Remplacer" : "Téléverser un logo"}
                  </>
                )}
              </Button>

              {logoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={deleting || uploading}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Supprimer
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Astuce : utilisez un logo carré ou horizontal sur fond transparent (PNG/SVG) pour un rendu optimal sur vos documents PDF.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

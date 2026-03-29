"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Save,
  Eye,
  ArrowLeft,
  Check,
  Loader2,
  PenLine,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface SiteContentItem {
  id: string;
  page_slug: string;
  section_key: string;
  content_type: string;
  content: string;
  title: string | null;
  meta_description: string | null;
  version: number;
  is_published: boolean;
  last_updated_at: string;
  updated_by: string | null;
}

const PAGE_LABELS: Record<string, { label: string; description: string }> = {
  "mentions-legales": {
    label: "Mentions légales",
    description: "Informations légales obligatoires (LCEN art. 6)",
  },
  "politique-confidentialite": {
    label: "Politique de confidentialité",
    description: "Protection des données personnelles (RGPD)",
  },
  cgu: {
    label: "Conditions Générales d'Utilisation",
    description: "Règles d'utilisation de la plateforme",
  },
  cgv: {
    label: "Conditions Générales de Vente",
    description: "Tarifs, paiements, résiliation",
  },
  cookies: {
    label: "Politique de cookies",
    description: "Cookies utilisés et gestion des préférences",
  },
  faq: {
    label: "FAQ",
    description: "Questions fréquemment posées",
  },
  "a-propos": {
    label: "À propos",
    description: "Présentation de Talok et de l'équipe",
  },
};

export default function SiteContentAdminPage() {
  const [pages, setPages] = useState<SiteContentItem[]>([]);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editMetaDescription, setEditMetaDescription] = useState("");
  const [editContent, setEditContent] = useState("");

  const { toast } = useToast();
  const supabase = createClient();

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/site-content");
      if (res.ok) {
        const json = await res.json();
        setPages(json.data || []);
      }
    } catch {
      // Table might not exist yet
      setPages([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Get unique pages (latest version of each)
  const uniquePages = pages.reduce(
    (acc, page) => {
      const key = `${page.page_slug}:${page.section_key}`;
      if (
        !acc[key] ||
        page.version > acc[key].version
      ) {
        acc[key] = page;
      }
      return acc;
    },
    {} as Record<string, SiteContentItem>
  );

  const pageList = Object.values(uniquePages).sort((a, b) =>
    a.page_slug.localeCompare(b.page_slug)
  );

  const openEditor = (page: SiteContentItem) => {
    setSelectedPage(page.page_slug);
    setEditTitle(page.title || "");
    setEditMetaDescription(page.meta_description || "");
    setEditContent(page.content || "");
    setEditMode(true);
    setShowPreview(false);
  };

  const handleSave = async (publish: boolean) => {
    if (!selectedPage) return;
    setSaving(true);

    try {
      const res = await fetch("/api/admin/site-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_slug: selectedPage,
          section_key: "content_body",
          content_type: "markdown",
          content: editContent,
          title: editTitle,
          meta_description: editMetaDescription,
          is_published: publish,
        }),
      });

      if (res.ok) {
        toast({
          title: publish ? "Publié" : "Brouillon sauvegardé",
          description: publish
            ? "Le contenu est maintenant visible sur le site."
            : "Le brouillon a été sauvegardé.",
        });
        await fetchPages();
      } else {
        const err = await res.json();
        toast({
          title: "Erreur",
          description: err.error || "Erreur lors de la sauvegarde.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder.",
        variant: "destructive",
      });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editMode && selectedPage) {
    const pageInfo = PAGE_LABELS[selectedPage];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditMode(false)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {pageInfo?.label || selectedPage}
            </h1>
            <p className="text-sm text-muted-foreground">
              {pageInfo?.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titre de la page</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titre affiché en H1 et dans l'onglet du navigateur"
              />
            </div>

            <div>
              <Label htmlFor="meta">Meta description (SEO)</Label>
              <Input
                id="meta"
                value={editMetaDescription}
                onChange={(e) => setEditMetaDescription(e.target.value)}
                placeholder="Description pour les moteurs de recherche (max 160 caractères)"
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editMetaDescription.length}/160 caractères
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="content">Contenu (Markdown)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {showPreview ? "Éditeur" : "Prévisualiser"}
                </Button>
              </div>
              {showPreview ? (
                <Card className="min-h-[500px]">
                  <CardContent className="prose prose-slate max-w-none p-6">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: editContent
                          .replace(/^### (.*$)/gm, "<h3>$1</h3>")
                          .replace(/^## (.*$)/gm, "<h2>$1</h2>")
                          .replace(/^# (.*$)/gm, "<h1>$1</h1>")
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\*(.*?)\*/g, "<em>$1</em>")
                          .replace(/\n/g, "<br/>"),
                      }}
                    />
                  </CardContent>
                </Card>
              ) : (
                <Textarea
                  id="content"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Écrivez le contenu en Markdown..."
                  className="min-h-[500px] font-mono text-sm"
                />
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Sauvegarder le brouillon
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Publier
              </Button>
            </div>
          </div>

          {/* Preview Panel (large screens) */}
          <div className="hidden lg:block">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Aperçu</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-slate prose-sm max-w-none max-h-[700px] overflow-y-auto">
                <h1>{editTitle || "Sans titre"}</h1>
                <div
                  dangerouslySetInnerHTML={{
                    __html: editContent
                      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
                      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
                      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\*(.*?)\*/g, "<em>$1</em>")
                      .replace(/\n/g, "<br/>"),
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contenu du site</h1>
        <p className="text-muted-foreground">
          Modifiez le contenu des pages légales et d&apos;information de
          talok.fr. Les modifications sont sauvegardées en brouillon puis
          publiées manuellement.
        </p>
      </div>

      {/* Existing CMS pages */}
      {pageList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Pages existantes</h2>
          {pageList.map((page) => {
            const info = PAGE_LABELS[page.page_slug];
            return (
              <Card
                key={page.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openEditor(page)}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {info?.label || page.page_slug}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {info?.description || page.section_key}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={page.is_published ? "default" : "secondary"}
                    >
                      {page.is_published ? "Publié" : "Brouillon"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      v{page.version} —{" "}
                      {new Date(page.last_updated_at).toLocaleDateString(
                        "fr-FR"
                      )}
                    </span>
                    <PenLine className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick-create for pages not yet in CMS */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {pageList.length > 0
            ? "Ajouter une page au CMS"
            : "Créer du contenu"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Les pages légales ont actuellement du contenu hardcodé. Cliquez pour
          créer une version éditable dans le CMS (qui prendra la priorité sur
          le contenu hardcodé).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(PAGE_LABELS)
            .filter(
              ([slug]) =>
                !pageList.some((p) => p.page_slug === slug)
            )
            .map(([slug, info]) => (
              <Card
                key={slug}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSelectedPage(slug);
                  setEditTitle(info.label);
                  setEditMetaDescription("");
                  setEditContent("");
                  setEditMode(true);
                }}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{info.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {pageList.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Aucun contenu dans le CMS</p>
            <p className="text-sm mt-1">
              Les pages légales utilisent actuellement du contenu intégré au
              code. Créez des entrées CMS pour pouvoir les modifier sans
              toucher au code.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

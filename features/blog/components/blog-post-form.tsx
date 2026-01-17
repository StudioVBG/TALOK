"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { blogService } from "../services/blog.service";
import type { CreateBlogPostData, UpdateBlogPostData } from "../services/blog.service";
import type { BlogPost } from "@/lib/types";

interface BlogPostFormProps {
  post?: BlogPost;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BlogPostForm({ post, onSuccess, onCancel }: BlogPostFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateBlogPostData>({
    slug: "",
    titre: "",
    contenu: "",
    tags: [],
    is_published: false,
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (post) {
      setFormData({
        slug: post.slug,
        titre: post.titre,
        contenu: post.contenu,
        tags: post.tags || [],
        is_published: post.is_published,
      });
    }
  }, [post]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData({ ...formData, titre: title });
    if (!post) {
      setFormData((prev) => ({ ...prev, slug: generateSlug(title) }));
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (post) {
        await blogService.updatePost(post.id, formData);
        toast({
          title: "Article mis à jour",
          description: "L'article a été modifié avec succès.",
        });
      } else {
        await blogService.createPost(formData);
        toast({
          title: "Article créé",
          description: "L'article a été créé avec succès.",
        });
      }
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{post ? "Modifier l'article" : "Nouvel article"}</CardTitle>
        <CardDescription>
          {post ? "Modifiez l'article de blog" : "Créez un nouvel article pour le centre d'aide"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Titre de l'article"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="url-de-l-article"
              required
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              URL de l'article (généré automatiquement depuis le titre)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contenu">Contenu *</Label>
            <textarea
              id="contenu"
              className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.contenu}
              onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
              placeholder="Contenu de l'article (Markdown supporté)"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Ajouter un tag"
                disabled={loading}
              />
              <Button type="button" onClick={addTag} disabled={loading}>
                Ajouter
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-sm px-2 py-1 rounded bg-muted flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive"
                      disabled={loading}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_published"
              checked={formData.is_published}
              onChange={(e) =>
                setFormData({ ...formData, is_published: e.target.checked })
              }
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="is_published" className="cursor-pointer">
              Publier immédiatement
            </Label>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : post ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


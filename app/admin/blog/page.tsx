"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { BlogPostCard } from "@/features/blog/components/blog-post-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { blogService } from "@/features/blog/services/blog.service";
import type { BlogPost } from "@/lib/types";
import Link from "next/link";

function AdminBlogPageContent() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await blogService.getAllPosts();
      setPosts(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger les articles.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestion du blog</h1>
          <p className="text-muted-foreground">Créez et gérez les articles du centre d'aide</p>
        </div>
        <Link href="/admin/blog/new">
          <Button>Nouvel article</Button>
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Aucun article créé.</p>
          <Link href="/admin/blog/new">
            <Button>Créer le premier article</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.id} className="relative">
              <BlogPostCard post={post} />
              {!post.is_published && (
                <span className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                  Brouillon
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminBlogPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminBlogPageContent />
    </ProtectedRoute>
  );
}


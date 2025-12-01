"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { BlogPostCard } from "@/features/blog/components/blog-post-card";
import { BlogSearch } from "@/features/blog/components/blog-search";
import { blogService } from "@/features/blog/services/blog.service";
import type { BlogPost } from "@/lib/types";

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    try {
      setLoading(true);
      const data = await blogService.getPublishedPosts();
      setPosts(data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Chargement des articles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Centre d'aide</h1>
        <p className="text-muted-foreground">
          Trouvez des réponses à vos questions et des guides d'utilisation
        </p>
      </div>

      <BlogSearch
        onResults={(results) => {
          setPosts(results);
          setLoading(false);
        }}
        onSearching={setSearching}
      />

      {(loading || searching) ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">
              {searching ? "Recherche en cours..." : "Chargement des articles..."}
            </p>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Aucun article trouvé.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}


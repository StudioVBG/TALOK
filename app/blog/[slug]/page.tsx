"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { blogService } from "@/features/blog/services/blog.service";
import type { BlogPost } from "@/lib/types";
import { formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BlogPostPage() {
  const params = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.slug) {
      fetchPost(params.slug as string);
    }
  }, [params.slug]);

  async function fetchPost(slug: string) {
    try {
      setLoading(true);
      const data = await blogService.getPostBySlug(slug);
      setPost(data);
    } catch (error) {
      console.error("Error fetching post:", error);
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
            <p className="mt-4 text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Article non trouvé</h1>
          <Link href="/blog">
            <Button>Retour au centre d'aide</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Link href="/blog">
        <Button variant="ghost">← Retour au centre d'aide</Button>
      </Link>

      <article className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-4">{post.titre}</h1>
          {post.published_at && (
            <p className="text-muted-foreground">
              Publié le {formatDateShort(post.published_at)}
            </p>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-3 py-1 rounded-full bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="prose prose-slate max-w-none">
          <div className="whitespace-pre-wrap">{post.contenu}</div>
        </div>
      </article>
    </div>
  );
}


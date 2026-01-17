"use client";
// @ts-nocheck

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { BlogPostForm } from "@/features/blog/components/blog-post-form";
import { blogService } from "@/features/blog/services/blog.service";
import type { BlogPost } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

function EditBlogPostPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPost = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const data = await blogService.getPostById(id);
      setPost(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger l'article.",
        variant: "destructive",
      });
      router.push("/admin/blog");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    if (params.id) {
      fetchPost(params.id as string);
    }
  }, [params.id, fetchPost]);

  const handleSuccess = () => {
    router.push("/admin/blog");
  };

  const handleCancel = () => {
    router.push("/admin/blog");
  };

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

  if (!post) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <BlogPostForm post={post} onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}

export default function EditBlogPostPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <EditBlogPostPageContent />
    </ProtectedRoute>
  );
}


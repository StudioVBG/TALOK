"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { BlogPostForm } from "@/features/blog/components/blog-post-form";
import { useRouter } from "next/navigation";

function NewBlogPostPageContent() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/admin/blog");
  };

  const handleCancel = () => {
    router.push("/admin/blog");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <BlogPostForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}

export default function NewBlogPostPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <NewBlogPostPageContent />
    </ProtectedRoute>
  );
}


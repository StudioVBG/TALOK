import { createClient } from "@/lib/supabase/client";
import { blogPostSchema, blogPostUpdateSchema } from "@/lib/validations";
import type { BlogPost } from "@/lib/types";

export interface CreateBlogPostData {
  slug: string;
  titre: string;
  contenu: string;
  tags: string[];
  is_published: boolean;
}

export interface UpdateBlogPostData extends Partial<CreateBlogPostData> {
  published_at?: string | null;
}

export class BlogService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async getPublishedPosts() {
    const { data, error } = await this.supabase
      .from("blog_posts")
      .select("*")
      .eq("is_published", true as any)
      .order("published_at", { ascending: false });

    if (error) throw error;
    return data as BlogPost[];
  }

  async getAllPosts() {
    const { data, error } = await this.supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as BlogPost[];
  }

  async getPostBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug as any)
      .single();

    if (error) throw error;
    return data as BlogPost;
  }

  async getPostById(id: string) {
    const { data, error } = await this.supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id as any)
      .single();

    if (error) throw error;
    return data as BlogPost;
  }

  async createPost(data: CreateBlogPostData) {
    const validatedData = blogPostSchema.parse(data);

    // Récupérer l'utilisateur actuel
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Récupérer le profil
    const { data: profile, error: profileError } = await this.supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) throw new Error("Profile not found");
    const profileData = profile as any;
    if (profileData.role !== "admin") throw new Error("Only admins can create blog posts");

    // Créer l'article
    const postData: any = {
      ...validatedData,
      author_id: profileData.id as any,
      published_at: validatedData.is_published ? new Date().toISOString() : null,
    };

    const { data: post, error } = await this.supabase
      .from("blog_posts")
      .insert(postData)
      .select()
      .single();

    if (error) throw error;
    return post as BlogPost;
  }

  async updatePost(id: string, data: UpdateBlogPostData) {
    const validatedData = blogPostUpdateSchema.parse(data);

    // Si on publie l'article, mettre à jour published_at
    const updateData: Record<string, any> = { ...validatedData };
    if (validatedData.is_published === true) {
      const post = await this.getPostById(id);
      const postData = post as any;
      if (!postData.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    const { data: post, error } = await (this.supabase
      .from("blog_posts") as any)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return post as BlogPost;
  }

  async deletePost(id: string) {
    const { error } = await this.supabase.from("blog_posts").delete().eq("id", id);

    if (error) throw error;
  }

  async getPostsByTag(tag: string) {
    const { data, error } = await this.supabase
      .from("blog_posts")
      .select("*")
      .eq("is_published", true as any)
      .contains("tags", [tag] as any)
      .order("published_at", { ascending: false });

    if (error) throw error;
    return data as BlogPost[];
  }
}

export const blogService = new BlogService();


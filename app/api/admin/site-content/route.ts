import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/site-content
 * Liste toutes les pages de contenu (dernière version publiée de chaque page)
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérifier le rôle admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "platform_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Récupérer toutes les pages (toutes versions)
  const { data, error } = await supabase
    .from("site_content")
    .select("*")
    .order("page_slug")
    .order("version", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/admin/site-content
 * Créer ou mettre à jour le contenu d'une page
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "platform_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    page_slug,
    section_key = "content_body",
    content_type = "markdown",
    content,
    title,
    meta_description,
    is_published = false,
  } = body;

  if (!page_slug || !content) {
    return NextResponse.json(
      { error: "page_slug et content sont requis" },
      { status: 400 }
    );
  }

  // Récupérer la version actuelle la plus élevée
  const { data: existing } = await supabase
    .from("site_content")
    .select("version")
    .eq("page_slug", page_slug)
    .eq("section_key", section_key)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (existing?.version || 0) + 1;

  // Insérer la nouvelle version
  const { data, error } = await supabase
    .from("site_content")
    .insert({
      page_slug,
      section_key,
      content_type,
      content,
      title,
      meta_description,
      version: nextVersion,
      is_published,
      updated_by: user.id,
      last_updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si publié, dépublier les anciennes versions
  if (is_published) {
    await supabase
      .from("site_content")
      .update({ is_published: false })
      .eq("page_slug", page_slug)
      .eq("section_key", section_key)
      .neq("version", nextVersion);
  }

  return NextResponse.json({ data });
}

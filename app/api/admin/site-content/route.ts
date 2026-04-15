import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { validateCsrfFromRequest } from "@/lib/security/csrf";

/**
 * GET /api/admin/site-content
 * Liste toutes les pages de contenu (dernière version publiée de chaque page)
 */
export async function GET(request: Request) {
  const { error: authError, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  // Récupérer toutes les pages (toutes versions)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
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
  // CSRF validation
  try {
    const csrfValid = await validateCsrfFromRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
    }
  } catch {
    // CSRF_SECRET not configured — degrade gracefully
  }

  const { error: authError, user, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("site_content")
    .select("version")
    .eq("page_slug", page_slug)
    .eq("section_key", section_key)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = Number(existing?.version ?? 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (supabase as any).from("site_content");

  // Insérer la nouvelle version
  const { data, error } = await sc
    .insert({
      page_slug,
      section_key,
      content_type,
      content,
      title,
      meta_description,
      version: nextVersion,
      is_published,
      updated_by: user!.id,
      last_updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si publié, dépublier les anciennes versions
  if (is_published) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("site_content")
      .update({ is_published: false })
      .eq("page_slug", page_slug)
      .eq("section_key", section_key)
      .neq("version", nextVersion);
  }

  return NextResponse.json({ data });
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/addons - Lister tous les add-ons avec statistiques
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Récupérer les add-ons
    const { data: addons, error } = await supabase
      .from("subscription_addons")
      .select("*")
      .order("display_order");

    if (error) throw error;

    // Compter les souscriptions actives pour chaque add-on
    const addonsWithStats = await Promise.all(
      (addons || []).map(async (addon) => {
        const { count } = await supabase
          .from("subscription_addon_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("addon_id", addon.id)
          .eq("status", "active");
        
        return {
          ...addon,
          active_subscriptions_count: count || 0
        };
      })
    );

    return NextResponse.json({ addons: addonsWithStats });
  } catch (error: unknown) {
    console.error("[Admin Addons GET]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * POST /api/admin/addons - Créer un nouvel add-on
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, 
      slug,
      description, 
      price_monthly = 0, 
      price_yearly = 0, 
      features = {},
      compatible_plans = [],
      is_active = true,
      display_order = 0
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Nom et slug requis" }, { status: 400 });
    }

    // Créer l'add-on
    const { data: addon, error } = await supabase
      .from("subscription_addons")
      .insert({
        name,
        slug,
        description,
        price_monthly,
        price_yearly,
        features,
        compatible_plans,
        is_active,
        display_order
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "addon_created",
      entity_type: "subscription_addon",
      entity_id: addon.id,
      metadata: { addon_name: name, slug }
    });

    return NextResponse.json({ addon });
  } catch (error: unknown) {
    console.error("[Admin Addons POST]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/addons - Mettre à jour un add-on
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { 
      id,
      name, 
      description, 
      price_monthly, 
      price_yearly, 
      features,
      compatible_plans,
      is_active,
      display_order
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID de l'add-on requis" }, { status: 400 });
    }

    // Mettre à jour l'add-on
    const { data: addon, error } = await supabase
      .from("subscription_addons")
      .update({
        name,
        description,
        price_monthly,
        price_yearly,
        features,
        compatible_plans,
        is_active,
        display_order,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "addon_updated",
      entity_type: "subscription_addon",
      entity_id: id,
      metadata: { changes: body }
    });

    return NextResponse.json({ addon });
  } catch (error: unknown) {
    console.error("[Admin Addons PUT]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/addons - Supprimer un add-on (soft delete via is_active)
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID de l'add-on requis" }, { status: 400 });
    }

    // Vérifier s'il y a des souscriptions actives
    const { count } = await supabase
      .from("subscription_addon_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("addon_id", id)
      .eq("status", "active");

    if (count && count > 0) {
      return NextResponse.json({ 
        error: `Impossible de supprimer : ${count} souscription(s) active(s)` 
      }, { status: 400 });
    }

    // Soft delete (désactiver)
    const { error } = await supabase
      .from("subscription_addons")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    // Log audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "addon_deleted",
      entity_type: "subscription_addon",
      entity_id: id
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[Admin Addons DELETE]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BRANDING } from "@/lib/white-label/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * API pour résoudre le branding d'un domaine personnalisé
 *
 * GET /api/white-label/resolve?domain=example.com
 *
 * Retourne le branding de l'organisation associée au domaine,
 * ou le branding par défaut si le domaine n'est pas configuré.
 */
export async function GET(request: NextRequest) {
  try {
    const domain = request.nextUrl.searchParams.get("domain");

    // Si pas de domaine, retourner le branding par défaut
    if (!domain) {
      return NextResponse.json({
        success: true,
        branding: DEFAULT_BRANDING,
        isCustomDomain: false,
      });
    }

    const supabase = await createClient();

    // Chercher le domaine dans la base
    const { data: customDomain } = await supabase
      .from("custom_domains")
      .select(`
        id,
        domain,
        verified,
        organization:organizations(
          id,
          name,
          slug,
          white_label_level,
          branding:organization_branding(*)
        )
      `)
      .eq("domain", domain.toLowerCase())
      .eq("verified", true)
      .eq("is_active", true)
      .single();

    // Si domaine non trouvé ou non vérifié
    if (!customDomain || !customDomain.organization) {
      return NextResponse.json({
        success: true,
        branding: DEFAULT_BRANDING,
        isCustomDomain: false,
        reason: "domain_not_found",
      });
    }

    const org = customDomain.organization as any;
    const branding = org.branding || {};

    // Construire le branding effectif
    const effectiveBranding = {
      ...DEFAULT_BRANDING,
      ...Object.fromEntries(
        Object.entries(branding).filter(([_, v]) => v !== null)
      ),
    };

    return NextResponse.json({
      success: true,
      isCustomDomain: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        whiteLabelLevel: org.white_label_level,
      },
      branding: effectiveBranding,
      domain: {
        id: customDomain.id,
        domain: customDomain.domain,
        verified: customDomain.verified,
      },
    });
  } catch (error) {
    console.error("Erreur résolution white-label:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur serveur",
        branding: DEFAULT_BRANDING,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/white-label/resolve
 *
 * Vérifie si un domaine peut être ajouté (non utilisé)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json(
        { success: false, error: "Domaine requis" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Vérifier si le domaine existe déjà
    const { data: existing } = await supabase
      .from("custom_domains")
      .select("id, organization_id, verified")
      .eq("domain", domain.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({
        success: false,
        available: false,
        reason: existing.verified ? "domain_in_use" : "domain_pending",
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
    });
  } catch (error) {
    console.error("Erreur vérification domaine:", error);
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

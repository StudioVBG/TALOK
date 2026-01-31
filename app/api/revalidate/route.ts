export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour forcer la revalidation du cache Next.js
 * Utilisée après création/modification de données pour rafraîchir les Server Components
 *
 * @security CRITICAL - Requiert authentification admin/system
 * @module app/api/revalidate/route
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { timingSafeEqual } from "crypto";

/**
 * Valide le token de revalidation interne (pour les appels système)
 */
function validateRevalidationToken(request: Request): boolean {
  const token = request.headers.get("x-revalidation-token");
  const expectedToken = process.env.REVALIDATION_SECRET;

  // Si pas de secret configuré, on refuse les appels avec token
  if (!expectedToken || !token) {
    return false;
  }

  // Comparaison timing-safe pour éviter les timing attacks
  try {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expectedToken);

    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Valide les paths autorisés pour la revalidation
 * Empêche la revalidation de paths arbitraires
 */
function isPathAllowed(path: string): boolean {
  const allowedPrefixes = [
    "/dashboard",
    "/properties",
    "/leases",
    "/tenants",
    "/documents",
    "/payments",
    "/admin",
    "/",
  ];

  // Bloquer les paths suspects
  if (path.includes("..") || path.includes("//")) {
    return false;
  }

  return allowedPrefixes.some(prefix => path === prefix || path.startsWith(prefix + "/"));
}

/**
 * Valide les tags autorisés pour la revalidation
 */
function isTagAllowed(tag: string): boolean {
  const allowedTagPrefixes = [
    "owner:",
    "admin:",
    "tenant:",
    "property:",
    "lease:",
    "document:",
    "payment:",
  ];

  return allowedTagPrefixes.some(prefix => tag.startsWith(prefix));
}

export async function POST(request: Request) {
  try {
    // 1. Rate limiting - limite les appels à 30/minute
    const rateLimitResponse = await applyRateLimit(request, "revalidate");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 2. Vérifier l'authentification
    const hasValidToken = validateRevalidationToken(request);

    if (!hasValidToken) {
      // Si pas de token système valide, vérifier l'authentification utilisateur
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Vérifier que l'utilisateur a un rôle admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        console.warn(`[revalidate] Unauthorized access attempt by user ${user.id}`);
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
    }

    // 3. Valider les paramètres
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    const tag = searchParams.get("tag");

    // 4. Revalidation avec validation des paths/tags
    let revalidatedPath = false;
    let revalidatedTag = false;

    if (path) {
      if (!isPathAllowed(path)) {
        return NextResponse.json(
          { error: "Invalid path for revalidation" },
          { status: 400 }
        );
      }
      revalidatePath(path);
      revalidatedPath = true;
      console.log(`[revalidate] Path revalidated: ${path}`);
    }

    if (tag) {
      if (!isTagAllowed(tag)) {
        return NextResponse.json(
          { error: "Invalid tag for revalidation" },
          { status: 400 }
        );
      }
      revalidateTag(tag);
      revalidatedTag = true;
      console.log(`[revalidate] Tag revalidated: ${tag}`);
    }

    // 5. Revalider les tags standards si aucun tag spécifié (pour les admins uniquement)
    if (!tag && !path) {
      revalidateTag("owner:properties");
      revalidateTag("admin:properties");
      revalidateTag("owner:leases");
      revalidateTag("owner:dashboard");
      console.log("[revalidate] Tags standards revalidated");
    }

    return NextResponse.json({
      success: true,
      revalidated: {
        path: revalidatedPath ? path : null,
        tag: revalidatedTag ? tag : null
      },
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    console.error("[revalidate] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la revalidation" },
      { status: 500 }
    );
  }
}


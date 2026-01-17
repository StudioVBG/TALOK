export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route API pour forcer la revalidation du cache Next.js
 * Utilisée après création/modification de données pour rafraîchir les Server Components
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    const tag = searchParams.get("tag");

    if (path) {
      revalidatePath(path);
      console.log(`[revalidate] Path revalidated: ${path}`);
    }

    if (tag) {
      revalidateTag(tag);
      console.log(`[revalidate] Tag revalidated: ${tag}`);
    }

    // Revalider aussi les tags standards si aucun tag spécifié
    if (!tag) {
      revalidateTag("owner:properties");
      revalidateTag("admin:properties");
      revalidateTag("owner:leases");
      revalidateTag("owner:dashboard");
      console.log("[revalidate] Tags standards revalidated");
    }

    return NextResponse.json({ 
      success: true, 
      revalidated: { path, tag },
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


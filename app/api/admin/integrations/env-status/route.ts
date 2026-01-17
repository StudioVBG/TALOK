export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/integrations/env-status
 * Renvoie l'état de la configuration Supabase (sans exposer les secrets)
 */
export async function GET(request: Request) {
  const { error, user } = await requireAdmin(request);

  if (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
      { status: error.status }
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  return NextResponse.json({
    supabaseUrl,
    serviceRoleKeySet: Boolean(serviceRoleKey),
  });
}





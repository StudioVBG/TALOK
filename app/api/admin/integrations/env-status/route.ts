export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Renvoie l'état de la configuration Supabase (URL, anon key, service role) sans exposer les secrets
 * @usage GET /api/admin/integrations/env-status
 */
export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.integrations.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation état config Supabase",
  });
  if (isAdminAuthError(auth)) return auth;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

  return NextResponse.json({
    supabaseUrl,
    serviceRoleKeySet: Boolean(serviceRoleKey),
  });
}





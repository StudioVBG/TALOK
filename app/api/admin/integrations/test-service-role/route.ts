export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * POST /api/admin/integrations/test-service-role
 * Vérifie que la clé service-role est configurée et peut interroger Supabase
 */
export async function POST(request: Request) {
  const { error, user } = await requireAdmin(request);

  if (error) {
    return NextResponse.json(
      { error: error.message, details: (error as any).details },
      { status: error.status }
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Clé service-role ou URL Supabase manquante" },
        { status: 400 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: queryError } = await serviceClient
      .from("profiles")
      .select("id")
      .limit(1);

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Error testing service role:", err);
    return NextResponse.json(
      { error: err.message || "Test échoué" },
      { status: 500 }
    );
  }
}





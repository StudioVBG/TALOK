export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Utiliser la RPC dashboard pour récupérer les infos de bail de manière cohérente
  const { data, error } = await supabase.rpc("tenant_dashboard", {
    p_tenant_user_id: user.id,
  });

  if (error) {
    console.error("[GET /api/tenant/lease] RPC Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ 
    lease: data?.lease || null,
    property: data?.property || null
  });
}


/**
 * POST /api/admin/subscriptions/override
 * Force un changement de plan (admin only)
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { adminOverridePlan } from "@/lib/subscriptions/subscription-service";
import { z } from "zod";

const overrideSchema = z.object({
  user_id: z.string().uuid(),
  target_plan: z.enum(["starter", "confort", "pro", "enterprise"]),
  reason: z.string().min(3),
  notify_user: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = overrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { user_id, target_plan, reason, notify_user } = parsed.data;

    const result = await adminOverridePlan(
      user.id,
      user_id,
      target_plan,
      reason,
      notify_user
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Admin Override POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


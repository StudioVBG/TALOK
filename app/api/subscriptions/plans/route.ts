export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/subscriptions/plans - Lister les plans actifs (public)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (error) throw error;

    return NextResponse.json({ plans: plans || [] });
  } catch (error: any) {
    console.error("[Subscriptions Plans GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


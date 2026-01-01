export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/subscriptions/addons - Lister les add-ons actifs (public)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: addons, error } = await supabase
      .from("subscription_addons")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (error) throw error;

    return NextResponse.json({ addons: addons || [] });
  } catch (error: any) {
    console.error("[Subscriptions Addons GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


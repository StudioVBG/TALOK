/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../_lib/supabase";

function genCode() {
  return "U" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = genCode();
  const { error } = await sb
    .from("units")
    .update({ code_unique: code })
    .eq("id", id);
  
  if (error) return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });

  return NextResponse.json({ code });
}


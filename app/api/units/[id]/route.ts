export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { supabaseServer } from "../../_lib/supabase";
import { revalidateTag } from "next/cache";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { error } = await sb
    .from("units")
    .update(body)
    .eq("id", params.id);
  
  if (error) return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });

  revalidateTag("owner:properties");
  revalidateTag("admin:properties");
  
  return NextResponse.json({ ok: true });
}


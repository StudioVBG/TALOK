export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";

const STATUS_MAP: Record<string, string> = {
  brouillon: "draft",
  en_attente: "pending",
  publie: "published",
  publié: "published",
  rejete: "rejected",
  rejeté: "rejected",
  archive: "archived",
  archivé: "archived",
};

export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.properties.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation liste des biens",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? undefined;
  const mappedStatus = statusParam && statusParam !== "all"
    ? STATUS_MAP[statusParam] ?? statusParam
    : undefined;

  let query = supabase.from("properties").select("*").order("created_at", { ascending: false });

  if (mappedStatus) {
    query = query.eq("etat", mappedStatus);
  }

  const { data: properties, error: queryError } = await query;

  if (queryError) {
    return NextResponse.json(
      { error: queryError.message || "Impossible d'afficher les logements" },
      { status: 500 }
    );
  }

  return NextResponse.json({ properties: properties ?? [] });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: report, error } = await supabase
      .from("vetusty_reports")
      .select("*, vetusty_items(*)")
      .eq("id", reportId)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Rapport introuvable" }, { status: 404 });
    }

    const reportData = report as Record<string, unknown>;
    const items = (reportData.vetusty_items || []) as Array<Record<string, unknown>>;

    const htmlContent = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"><title>Rapport de vétusté</title>
      <style>body{font-family:Arial,sans-serif;margin:40px}h1{color:#1a1a1a}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style>
      </head><body>
      <h1>Rapport de vétusté #${reportId.slice(0, 8)}</h1>
      <p>Date: ${new Date().toLocaleDateString("fr-FR")}</p>
      <table><thead><tr><th>Élément</th><th>État</th><th>Vétusté (%)</th><th>Commentaire</th></tr></thead>
      <tbody>${items.map((item) => `<tr><td>${item.element || ""}</td><td>${item.etat || ""}</td><td>${item.vetuste_pct || 0}%</td><td>${item.commentaire || ""}</td></tr>`).join("")}</tbody>
      </table></body></html>
    `;

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="vetusty-report-${reportId.slice(0, 8)}.html"`,
      },
    });
  } catch (error) {
    console.error("[Vetusty PDF] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

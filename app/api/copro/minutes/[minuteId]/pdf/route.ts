export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/copro/minutes/[minuteId]/pdf
 *
 * Retourne le HTML du procès-verbal.
 * Le client convertit ensuite en PDF via html2pdf.js côté client.
 *
 * Query params:
 *   - format=json — retourne les données brutes au lieu du HTML (debugging)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { generateMinuteHtml, type MinutePdfData } from "@/lib/pdf/syndic-templates";

interface RouteParams {
  params: { minuteId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "html";

    // 1. Charger le PV
    const supabaseAdminClient = (await import("@/app/api/_lib/supabase")).supabaseAdmin();
    const { data: minute, error: minuteError } = await supabaseAdminClient
      .from("copro_minutes")
      .select("*")
      .eq("id", params.minuteId)
      .maybeSingle();

    if (minuteError || !minute) {
      return NextResponse.json({ error: "PV introuvable" }, { status: 404 });
    }

    // 2. Auth + vérif accès au site
    const auth = await requireSyndic(request, { siteId: (minute as any).site_id });
    if (auth instanceof NextResponse) return auth;

    // 3. Charger l'assemblée
    const { data: assembly, error: assemblyError } = await auth.serviceClient
      .from("copro_assemblies")
      .select("*")
      .eq("id", (minute as any).assembly_id)
      .single();

    if (assemblyError || !assembly) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    // 4. Charger le site
    const { data: site } = await auth.serviceClient
      .from("sites")
      .select(
        "name, address_line1, address_line2, postal_code, city, total_tantiemes_general, syndic_company_name, syndic_profile_id"
      )
      .eq("id", (minute as any).site_id)
      .single();

    const siteAny = site as any;

    // 5. Syndic profile
    let syndicName = "Syndic";
    if (siteAny?.syndic_profile_id) {
      const { data: syndicProfile } = await auth.serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", siteAny.syndic_profile_id)
        .maybeSingle();
      if (syndicProfile) {
        syndicName = `${(syndicProfile as any).prenom || ""} ${(syndicProfile as any).nom || ""}`.trim();
      }
    }

    // 6. Charger les résolutions avec votes
    const { data: resolutions } = await auth.serviceClient
      .from("copro_resolutions")
      .select("*")
      .eq("assembly_id", (assembly as any).id)
      .order("resolution_number", { ascending: true });

    // 7. Charger les noms président/secrétaire/scrutateurs depuis assembly
    let presidentName = "Non désigné";
    let secretaryName = "Non désigné";
    const scrutineersNames: string[] = [];

    const assemblyAny = assembly as any;
    if (assemblyAny.presided_by) {
      const { data: p } = await auth.serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", assemblyAny.presided_by)
        .maybeSingle();
      if (p) presidentName = `${(p as any).prenom || ""} ${(p as any).nom || ""}`.trim() || presidentName;
    }
    if (assemblyAny.secretary_profile_id) {
      const { data: s } = await auth.serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", assemblyAny.secretary_profile_id)
        .maybeSingle();
      if (s) secretaryName = `${(s as any).prenom || ""} ${(s as any).nom || ""}`.trim() || secretaryName;
    }
    if (assemblyAny.scrutineers && Array.isArray(assemblyAny.scrutineers)) {
      const scrutineerIds = assemblyAny.scrutineers
        .map((s: any) => s?.profile_id)
        .filter((id: any): id is string => !!id);
      if (scrutineerIds.length > 0) {
        const { data: scrProfiles } = await auth.serviceClient
          .from("profiles")
          .select("id, prenom, nom")
          .in("id", scrutineerIds);
        for (const sp of (scrProfiles || []) as any[]) {
          scrutineersNames.push(`${sp.prenom || ""} ${sp.nom || ""}`.trim());
        }
      }
    }

    // 8. Construire les données
    const totalTantiemes = siteAny?.total_tantiemes_general || 10000;
    const presentTantiemes = assemblyAny.present_tantiemes || 0;

    const pdfData: MinutePdfData = {
      site_name: siteAny?.name || "Copropriété",
      site_address: siteAny
        ? `${siteAny.address_line1}${siteAny.address_line2 ? `, ${siteAny.address_line2}` : ""}, ${siteAny.postal_code} ${siteAny.city}`
        : "",
      syndic_name: syndicName,
      syndic_company: siteAny?.syndic_company_name || undefined,
      assembly_reference: assemblyAny.reference_number || "",
      assembly_type: assemblyAny.assembly_type,
      assembly_title: assemblyAny.title,
      scheduled_at: assemblyAny.scheduled_at,
      held_at: assemblyAny.held_at || assemblyAny.scheduled_at,
      location: assemblyAny.location || "",
      president_name: presidentName,
      secretary_name: secretaryName,
      scrutineers_names: scrutineersNames,
      total_tantiemes: totalTantiemes,
      present_tantiemes: presentTantiemes,
      quorum_required: assemblyAny.quorum_required || 0,
      quorum_reached: assemblyAny.quorum_reached || false,
      resolutions: ((resolutions || []) as any[]).map((r) => ({
        resolution_number: r.resolution_number,
        title: r.title,
        description: r.description,
        category: r.category,
        majority_rule: r.majority_rule,
        status: r.status,
        votes_for_count: r.votes_for_count || 0,
        votes_against_count: r.votes_against_count || 0,
        votes_abstain_count: r.votes_abstain_count || 0,
        tantiemes_for: r.tantiemes_for || 0,
        tantiemes_against: r.tantiemes_against || 0,
        tantiemes_abstain: r.tantiemes_abstain || 0,
      })),
      version: (minute as any).version || 1,
      generated_at: new Date().toISOString(),
      contestation_deadline: (minute as any).contestation_deadline || undefined,
    };

    if (format === "json") {
      return NextResponse.json(pdfData);
    }

    const html = generateMinuteHtml(pdfData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="pv-${assemblyAny.reference_number || (minute as any).id}-v${(minute as any).version}.html"`,
      },
    });
  } catch (error) {
    console.error("[minute-pdf:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

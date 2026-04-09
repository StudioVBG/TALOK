export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * API RGPD Export — Article 20 (Droit à la portabilité)
 *
 * POST /api/rgpd/export → Crée une demande d'export et retourne le fichier JSON
 *
 * Enregistre la demande dans data_requests pour traçabilité,
 * puis délègue à /api/privacy/export pour l'export effectif.
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileId = (profile as any).id;

    // Rate limit: max 1 export per 24h
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentRequests } = await supabase
      .from("data_requests")
      .select("id")
      .eq("profile_id", profileId)
      .eq("request_type", "export")
      .gte("created_at", oneDayAgo.toISOString());

    if (recentRequests && recentRequests.length > 0) {
      return NextResponse.json(
        { error: "Vous avez déjà effectué un export dans les dernières 24 heures." },
        { status: 429 }
      );
    }

    // Create data request record
    const { error: requestError } = await supabase.from("data_requests").insert({
      profile_id: profileId,
      request_type: "export",
      status: "processing",
    } as any);

    if (requestError) {
      console.error("[rgpd/export] Request insert error:", requestError);
    }

    // Use the existing privacy export logic
    // Fetch all user data (same as /api/privacy/export)
    const profileData = await fetchAllUserData(supabase, user, profileId, (profile as any).role);

    // Mark request as completed
    await supabase
      .from("data_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() } as any)
      .eq("profile_id", profileId)
      .eq("request_type", "export")
      .eq("status", "processing");

    // Log in audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "rgpd_data_exported",
      entity_type: "user",
      entity_id: user.id,
      metadata: { source: "settings_privacy" },
    } as any);

    const jsonContent = JSON.stringify(profileData, null, 2);

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="talok-export-rgpd-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error: unknown) {
    console.error("[rgpd/export] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function fetchAllUserData(supabase: any, user: any, profileId: string, role: string) {
  const exportData: Record<string, any> = {
    export_date: new Date().toISOString(),
    export_version: "1.0",
    dpo_contact: "dpo@talok.fr",
    user: {
      id: user.id,
      email: user.email || "",
      created_at: user.created_at,
    },
    profile: null,
    role_profile: null,
    consents: null,
    consent_history: [],
    properties: [],
    leases: [],
    invoices: [],
    payments: [],
    documents: [],
    tickets: [],
    notifications: [],
  };

  // Profile
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, email, telephone, date_naissance, avatar_url, created_at, updated_at")
    .eq("id", profileId)
    .single();
  exportData.profile = profileRow;

  // Role-specific profile
  const roleTable = role === "owner" ? "owner_profiles" : role === "tenant" ? "tenant_profiles" : role === "provider" ? "provider_profiles" : null;
  if (roleTable) {
    const { data: roleProfile } = await supabase
      .from(roleTable)
      .select("*")
      .eq("profile_id", profileId)
      .single();
    exportData.role_profile = roleProfile;
  }

  // Consents
  const { data: consents } = await supabase
    .from("user_consents")
    .select("*")
    .eq("user_id", user.id)
    .single();
  exportData.consents = consents;

  // Consent history
  const { data: consentHistory } = await supabase
    .from("consent_records")
    .select("consent_type, granted, granted_at, version")
    .eq("profile_id", profileId)
    .order("granted_at", { ascending: false });
  exportData.consent_history = consentHistory || [];

  // Properties (owner only)
  if (role === "owner") {
    const { data: properties } = await supabase
      .from("properties")
      .select("*, units(*)")
      .eq("owner_id", profileId);
    exportData.properties = properties || [];
  }

  // Leases
  const { data: leases } = await supabase
    .from("leases")
    .select("*")
    .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);
  exportData.leases = leases || [];

  // Invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);
  exportData.invoices = invoices || [];

  // Payments
  if (invoices && invoices.length > 0) {
    const invoiceIds = invoices.map((i: any) => i.id);
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .in("invoice_id", invoiceIds);
    exportData.payments = payments || [];
  }

  // Documents (metadata only, not files)
  const { data: documents } = await supabase
    .from("documents")
    .select("id, type, filename, created_at, metadata")
    .or(`owner_id.eq.${profileId},tenant_id.eq.${profileId}`);
  exportData.documents = documents || [];

  // Tickets
  const { data: tickets } = await supabase
    .from("tickets")
    .select("*, ticket_messages(*)")
    .eq("created_by_profile_id", profileId);
  exportData.tickets = tickets || [];

  // Notifications (6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("profile_id", profileId)
    .gte("created_at", sixMonthsAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  exportData.notifications = notifications || [];

  return exportData;
}

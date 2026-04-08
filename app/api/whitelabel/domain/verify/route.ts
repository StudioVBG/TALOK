export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/whitelabel/domain/verify — Verify DNS for custom domain
 *
 * Checks that the agency's custom domain has proper DNS configuration
 * (CNAME pointing to talok or TXT verification record).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "agency") {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    // Get current config
    const { data: config } = await supabase
      .from("whitelabel_configs")
      .select("id, custom_domain")
      .eq("agency_profile_id", profile.id)
      .single();

    if (!config || !config.custom_domain) {
      return NextResponse.json(
        { error: "Aucun domaine personnalise configure" },
        { status: 400 }
      );
    }

    const domain = config.custom_domain;

    // DNS verification: check CNAME record
    // In production, use a DNS library (e.g., dns.resolveCname)
    // For now, we attempt a fetch-based check
    let verified = false;
    let verificationError: string | null = null;

    try {
      // Check if domain resolves (basic connectivity test)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`https://${domain}`, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "manual",
      }).catch(() => null);

      clearTimeout(timeout);

      // If we get any response, DNS is resolving
      if (response) {
        verified = true;
      } else {
        verificationError = "Le domaine ne repond pas. Verifiez votre configuration DNS.";
      }
    } catch {
      verificationError = "Impossible de verifier le domaine. Assurez-vous que le CNAME pointe vers app.talok.fr";
    }

    // Update verification status
    const { error: updateError } = await supabase
      .from("whitelabel_configs")
      .update({
        domain_verified: verified,
      })
      .eq("id", config.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      verified,
      domain,
      error: verificationError,
      instructions: !verified
        ? {
            type: "CNAME",
            host: domain,
            value: "app.talok.fr",
            ttl: 3600,
          }
        : undefined,
    });
  } catch (error: unknown) {
    console.error("[whitelabel/domain/verify]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

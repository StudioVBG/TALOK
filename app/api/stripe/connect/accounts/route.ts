export const runtime = "nodejs";

/**
 * GET /api/stripe/connect/accounts
 *
 * Liste tous les comptes Stripe Connect du propriétaire :
 *   - le compte personnel (entity_id IS NULL)
 *   - les comptes scopés à une entité juridique (SCI, copropriété…)
 *
 * Réponse : ConnectAccountListItem[] (cf. lib/hooks/use-stripe-connect.ts)
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const serviceClient = createServiceRoleClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["owner", "syndic"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Seuls les propriétaires et syndics peuvent lister leurs comptes Connect" },
        { status: 403 }
      );
    }

    const { data: accounts, error } = await serviceClient
      .from("stripe_connect_accounts")
      .select(
        `
        id,
        entity_id,
        stripe_account_id,
        charges_enabled,
        payouts_enabled,
        details_submitted,
        bank_account_last4,
        bank_account_bank_name,
        legal_entities:entity_id ( id, nom, entity_type )
      `
      )
      .eq("profile_id", profile.id)
      .order("entity_id", { ascending: true, nullsFirst: true });

    if (error) {
      console.error("[Stripe Connect] Erreur liste comptes:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (accounts ?? []).map((account: any) => {
      const entity = Array.isArray(account.legal_entities)
        ? account.legal_entities[0]
        : account.legal_entities;

      return {
        id: account.id as string,
        entity_id: (account.entity_id as string | null) ?? null,
        entity_label: entity?.nom ?? "Compte personnel",
        stripe_account_id: account.stripe_account_id as string,
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        details_submitted: Boolean(account.details_submitted),
        bank_account_last4: (account.bank_account_last4 as string | null) ?? null,
        bank_account_bank_name: (account.bank_account_bank_name as string | null) ?? null,
      };
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("[Stripe Connect] Erreur liste comptes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

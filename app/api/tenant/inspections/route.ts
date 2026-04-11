export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import type { TenantEDLListItem } from "@/lib/types/tenant";

/**
 * GET /api/tenant/inspections
 *
 * Liste des états des lieux (EDL) accessibles au locataire.
 *
 * Pourquoi une route API ?
 * --------------------------
 * Le hook client précédent (useTenantInspections) interrogeait directement
 * Supabase via le client browser-side, avec un embed PostgREST profond
 * (`edl_signatures → edl → lease → property` ET `edl → property_details`).
 * Ce JOIN traversait plusieurs policies RLS et déclenchait des erreurs 500
 * (recursion 42P17 ou ambiguïté de relation), rendant la page totalement
 * inaccessible au locataire.
 *
 * On déplace la requête côté serveur en utilisant `getServiceClient()` :
 * l'authentification est vérifiée via `createClient()` + `getUser()`, puis
 * toutes les lectures de données passent par le service role qui bypasse
 * les RLS sans risque de récursion.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ inspections: [] });
    }

    // 1. Récupérer toutes les signatures EDL où ce profil est signataire
    //    (cast `any` car les colonnes signer_profile_id / property_id ont été
    //    ajoutées par migration ultérieure et ne sont pas dans database.types.ts)
    const { data: signaturesRaw, error: signaturesError } = await (serviceClient as any)
      .from("edl_signatures")
      .select(
        "id, edl_id, signer_profile_id, signed_at, invitation_token, signer_role"
      )
      .eq("signer_profile_id", profile.id);

    if (signaturesError) {
      console.error(
        "[GET /api/tenant/inspections] edl_signatures error:",
        signaturesError.message
      );
      return NextResponse.json(
        { error: "Erreur lors du chargement des états des lieux" },
        { status: 500 }
      );
    }

    const signatures = (signaturesRaw || []) as Array<{
      id: string;
      edl_id: string;
      signer_profile_id: string | null;
      signed_at: string | null;
      invitation_token: string | null;
      signer_role: string | null;
    }>;

    if (signatures.length === 0) {
      return NextResponse.json({ inspections: [] });
    }

    const edlIds = Array.from(
      new Set(signatures.map((s) => s.edl_id).filter(Boolean))
    );

    if (edlIds.length === 0) {
      return NextResponse.json({ inspections: [] });
    }

    // 2. Récupérer les EDL associés (sans embed pour éviter toute recursion RLS)
    const { data: edlsRaw, error: edlsError } = await (serviceClient as any)
      .from("edl")
      .select(
        "id, type, status, scheduled_at, scheduled_date, created_at, lease_id, property_id"
      )
      .in("id", edlIds);

    if (edlsError) {
      console.error(
        "[GET /api/tenant/inspections] edl error:",
        edlsError.message
      );
      return NextResponse.json(
        { error: "Erreur lors du chargement des états des lieux" },
        { status: 500 }
      );
    }

    const edlList = (edlsRaw || []) as Array<{
      id: string;
      type: string | null;
      status: string | null;
      scheduled_at: string | null;
      scheduled_date: string | null;
      created_at: string;
      lease_id: string | null;
      property_id: string | null;
    }>;

    // 3. Récupérer les propriétés (via property_id direct OU via lease_id)
    const directPropertyIds = edlList
      .map((e) => e.property_id)
      .filter((id): id is string => !!id);

    const leaseIds = edlList
      .map((e) => e.lease_id)
      .filter((id): id is string => !!id);

    const leasePropertyMap = new Map<string, string>();
    if (leaseIds.length > 0) {
      const { data: leases } = await serviceClient
        .from("leases")
        .select("id, property_id")
        .in("id", leaseIds);
      if (leases) {
        for (const l of leases as Array<{ id: string; property_id: string | null }>) {
          if (l.property_id) leasePropertyMap.set(l.id, l.property_id);
        }
      }
    }

    const allPropertyIds = Array.from(
      new Set([
        ...directPropertyIds,
        ...Array.from(leasePropertyMap.values()),
      ])
    );

    const propertyMap = new Map<string, any>();
    if (allPropertyIds.length > 0) {
      const { data: properties } = await serviceClient
        .from("properties")
        .select(
          "id, adresse_complete, ville, code_postal, type, surface_habitable_m2, nb_pieces"
        )
        .in("id", allPropertyIds);
      if (properties) {
        for (const p of properties as Array<{ id: string }>) {
          propertyMap.set(p.id, p);
        }
      }
    }

    // 4. Construire la liste enrichie pour le client
    const signatureByEdl = new Map<string, (typeof signatures)[number]>();
    for (const sig of signatures) {
      // Garder la signature la plus récemment signée si plusieurs existent
      const existing = signatureByEdl.get(sig.edl_id);
      if (
        !existing ||
        (sig.signed_at && (!existing.signed_at || sig.signed_at > existing.signed_at))
      ) {
        signatureByEdl.set(sig.edl_id, sig);
      }
    }

    const inspections: TenantEDLListItem[] = edlList
      .map((edl) => {
        const sig = signatureByEdl.get(edl.id);
        const propertyId =
          edl.property_id || (edl.lease_id ? leasePropertyMap.get(edl.lease_id) : undefined);
        const property = propertyId ? propertyMap.get(propertyId) ?? null : null;

        return {
          id: edl.id,
          type: (edl.type as "entree" | "sortie") || "entree",
          status: edl.status || "draft",
          scheduled_at:
            edl.scheduled_at || (edl.scheduled_date ? `${edl.scheduled_date}T00:00:00Z` : null),
          created_at: edl.created_at,
          invitation_token: sig?.invitation_token ?? undefined,
          property,
          isSigned: !!sig?.signed_at,
          needsMySignature: !sig?.signed_at && edl.status !== "draft",
        };
      })
      // En haut : ce qui nécessite une action du locataire
      .sort((a, b) => Number(b.needsMySignature) - Number(a.needsMySignature));

    return NextResponse.json({ inspections });
  } catch (error: unknown) {
    console.error("[GET /api/tenant/inspections] erreur:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

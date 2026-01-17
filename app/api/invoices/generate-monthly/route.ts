export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { z } from "zod";

const generateMonthlyInvoiceSchema = z.object({
  lease_id: z.string().uuid("L'ID du bail doit être un UUID valide"),
  periode: z.string().regex(/^\d{4}-\d{2}$/, "Format période invalide (YYYY-MM)"),
});

/**
 * POST /api/invoices/generate-monthly - Générer une facture mensuelle pour un bail
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue" },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Valider le body
    const body = await request.json();
    const validated = generateMonthlyInvoiceSchema.parse(body);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Récupérer le bail
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, loyer, charges_forfaitaires, property_id")
      .eq("id", validated.lease_id as any)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const leaseData = lease as any;

    // Vérifier les permissions (propriétaire ou admin uniquement)
    if (profileData.role !== "admin") {
      if (!leaseData.property_id) {
        return NextResponse.json(
          { error: "Bail invalide (pas de propriété associée)" },
          { status: 400 }
        );
      }

      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", leaseData.property_id as any)
        .single();

      if (!property || (property as any).owner_id !== profileData.id) {
        return NextResponse.json(
          { error: "Vous n'êtes pas autorisé à générer des factures pour ce bail" },
          { status: 403 }
        );
      }
    }

    // Vérifier si une facture existe déjà pour cette période
    const { data: existing } = await serviceClient
      .from("invoices")
      .select("id")
      .eq("lease_id", validated.lease_id as any)
      .eq("periode", validated.periode as any)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Une facture existe déjà pour cette période" },
        { status: 409 }
      );
    }

    // Récupérer le tenant_id depuis les signataires
    const { data: tenantSigner } = await serviceClient
      .from("lease_signers")
      .select("profile_id")
      .eq("lease_id", validated.lease_id as any)
      .eq("role", "locataire_principal")
      .maybeSingle();

    const tenantId = tenantSigner ? (tenantSigner as any).profile_id : null;

    // Créer la facture
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .insert({
        lease_id: validated.lease_id as any,
        owner_id: profileData.id,
        tenant_id: tenantId,
        periode: validated.periode as any,
        montant_loyer: Number(leaseData.loyer || 0),
        montant_charges: Number(leaseData.charges_forfaitaires || 0),
        montant_total: Number(leaseData.loyer || 0) + Number(leaseData.charges_forfaitaires || 0),
        statut: "draft" as any,
      } as any)
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return NextResponse.json(
        { error: "Erreur lors de la création de la facture" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error in POST /api/invoices/generate-monthly:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


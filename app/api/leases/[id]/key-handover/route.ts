export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateSignatureProof } from "@/lib/services/signature-proof.service";
import { extractClientIP } from "@/lib/utils/ip-address";
import { z } from "zod";

const keyItemSchema = z.object({
  type: z.string(),
  quantity: z.number().int().min(0).max(20),
  notes: z.string().optional(),
});

const accessCodeSchema = z.object({
  type: z.string(),
  code: z.string(),
  location: z.string().optional(),
});

const meterReadingSchema = z.object({
  meter_type: z.enum(["electricity", "gas", "water"]),
  value: z.number().min(0),
  unit: z.string(),
  photo_path: z.string().optional(),
});

const createHandoverSchema = z.object({
  handover_type: z.enum(["entree", "sortie"]),
  keys: z.array(keyItemSchema).min(1, "Au moins une clé doit être renseignée"),
  access_codes: z.array(accessCodeSchema).optional().default([]),
  handover_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  handover_time: z.string().optional(),
  meter_readings: z.array(meterReadingSchema).optional().default([]),
  notes: z.string().optional(),
});

/**
 * GET /api/leases/[id]/key-handover
 * Récupère la remise des clés d'un bail
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: handovers } = await serviceClient
      .from("key_handovers")
      .select("*")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ handovers: handovers || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leases/[id]/key-handover
 * Crée une remise des clés
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Seul le propriétaire peut créer une remise des clés" }, { status: 403 });
    }

    const serviceClient = getServiceClient();

    // Vérifier le bail
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, statut, property_id, properties!leases_property_id_fkey(owner_id)")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Récupérer le locataire
    const tenantRoles = ["locataire_principal", "locataire", "tenant", "principal"];
    const { data: tenantSigner } = await serviceClient
      .from("lease_signers")
      .select("profile_id")
      .eq("lease_id", leaseId)
      .in("role", tenantRoles)
      .not("profile_id", "is", null)
      .limit(1)
      .maybeSingle();

    const body = await request.json();
    const validated = createHandoverSchema.parse(body);

    // Déduplication
    const { data: existing } = await serviceClient
      .from("key_handovers")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("handover_type", validated.handover_type)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        error: `Une remise des clés de type "${validated.handover_type}" existe déjà`,
        existing_id: existing.id,
      }, { status: 409 });
    }

    const { data: handover, error: insertError } = await serviceClient
      .from("key_handovers")
      .insert({
        lease_id: leaseId,
        property_id: lease.property_id,
        handover_type: validated.handover_type,
        keys: validated.keys,
        access_codes: validated.access_codes,
        handover_date: validated.handover_date,
        handover_time: validated.handover_time || null,
        meter_readings: validated.meter_readings,
        notes: validated.notes || null,
        owner_profile_id: profile.id,
        tenant_profile_id: tenantSigner?.profile_id || null,
        status: "planned",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Audit + outbox
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "key_handover_created",
      entity_type: "key_handover",
      entity_id: handover.id,
      metadata: { lease_id: leaseId, type: validated.handover_type, keys_count: validated.keys.length },
    } as any);

    await serviceClient.from("outbox").insert({
      event_type: "KeyHandover.Created",
      payload: { handover_id: handover.id, lease_id: leaseId, type: validated.handover_type },
    } as any);

    return NextResponse.json({ handover }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/leases/[id]/key-handover
 * Signer la remise des clés (propriétaire ou locataire)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const { handover_id, signature_image, action } = body;

    if (action === "sign" && !signature_image) {
      return NextResponse.json({ error: "Signature requise" }, { status: 400 });
    }

    const { data: handover } = await serviceClient
      .from("key_handovers")
      .select("*")
      .eq("id", handover_id)
      .eq("lease_id", leaseId)
      .single();

    if (!handover) {
      return NextResponse.json({ error: "Remise des clés non trouvée" }, { status: 404 });
    }

    if (action === "start") {
      // Passer en "in_progress"
      await serviceClient
        .from("key_handovers")
        .update({ status: "in_progress" })
        .eq("id", handover_id);

      return NextResponse.json({ success: true, new_status: "in_progress" });
    }

    if (action === "sign") {
      const isOwner = profile.role === "owner";

      // Générer la preuve
      const proof = await generateSignatureProof({
        documentType: "REMISE_CLES",
        documentId: handover_id,
        documentContent: JSON.stringify(handover),
        signerName: `${profile.prenom} ${profile.nom}`,
        signerEmail: user.email!,
        signerProfileId: profile.id,
        identityVerified: true,
        identityMethod: isOwner ? "Compte Propriétaire" : "Compte Locataire",
        signatureType: "draw",
        signatureImage: signature_image,
        userAgent: request.headers.get("user-agent") || "",
        ipAddress: extractClientIP(request),
        screenSize: body.metadata?.screenSize || "",
        touchDevice: body.metadata?.touchDevice || false,
      });

      // Upload signature
      const base64Data = signature_image.replace(/^data:image\/\w+;base64,/, "");
      const fileName = `key-handovers/${handover_id}/${user.id}_${Date.now()}.png`;
      await serviceClient.storage
        .from("documents")
        .upload(fileName, Buffer.from(base64Data, "base64"), { contentType: "image/png", upsert: true });

      const updateData: Record<string, unknown> = {};
      if (isOwner) {
        updateData.owner_signed = true;
        updateData.owner_signed_at = proof.timestamp.iso;
        updateData.owner_signature_path = fileName;
      } else {
        updateData.tenant_signed = true;
        updateData.tenant_signed_at = proof.timestamp.iso;
        updateData.tenant_signature_path = fileName;
      }

      const otherSigned = isOwner ? handover.tenant_signed : handover.owner_signed;
      if (otherSigned) {
        updateData.status = "completed";
      }

      await serviceClient
        .from("key_handovers")
        .update(updateData)
        .eq("id", handover_id);

      // Audit
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "key_handover_signed",
        entity_type: "key_handover",
        entity_id: handover_id,
        metadata: {
          role: isOwner ? "owner" : "tenant",
          completed: updateData.status === "completed",
          proof_id: proof.proofId,
        },
      } as any);

      return NextResponse.json({
        success: true,
        new_status: updateData.status || "in_progress",
        proof_id: proof.proofId,
        completed: updateData.status === "completed",
      });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error: unknown) {
    console.error("[Key Handover] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

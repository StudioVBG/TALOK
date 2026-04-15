export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/copro/assemblies/[assemblyId]/send-convocations
 *
 * Dispatch les convocations en attente (status='pending') pour une AG.
 *
 * Body: { convocationIds?: string[] }
 *   - Si fourni : envoie uniquement ces convocations
 *   - Si omis : envoie toutes les convocations pending de l'AG
 *
 * Par convocation :
 *   - email → Resend (template copro-ag-convocation)
 *   - lrar/postal_recommande/lre_numerique/postal_simple → LRAR provider
 *   - hand_delivered → marqué comme envoyé sans dispatch
 *
 * Un échec sur une convocation ne bloque pas les autres.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { sendEmail } from "@/lib/emails/resend.service";
import { coproAgConvocationEmail } from "@/lib/emails/templates/copro-ag-convocation";
import { getLRARProvider } from "@/lib/services/lrar.service";
import type { LRARSender, LRARRecipient, LRARDocument, LRARSendOptions } from "@/lib/services/lrar.service";

interface RouteParams {
  params: { assemblyId: string };
}

interface SendResult {
  convocationId: string;
  recipientName: string;
  method: string;
  success: boolean;
  trackingNumber?: string;
  error?: string;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;

  try {
    const body = await request.json().catch(() => ({}));
    const convocationIds: string[] | undefined = body.convocationIds;

    // 1. Charger les convocations à envoyer
    let query = auth.serviceClient
      .from("copro_convocations")
      .select("*")
      .eq("assembly_id", assembly.id)
      .eq("status", "pending");

    if (convocationIds && convocationIds.length > 0) {
      query = query.in("id", convocationIds);
    }

    const { data: convocations, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!convocations || convocations.length === 0) {
      return NextResponse.json(
        { error: "Aucune convocation en attente à envoyer" },
        { status: 404 }
      );
    }

    // 2. Charger les données contextuelles (AG, site, syndic)
    const { data: assemblyData } = await auth.serviceClient
      .from("copro_assemblies")
      .select("*")
      .eq("id", assembly.id)
      .single();

    if (!assemblyData) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    const ag = assemblyData as any;

    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("name, address_line1, postal_code, city, syndic_profile_id, syndic_company_name, syndic_address, syndic_email, syndic_phone")
      .eq("id", ag.site_id)
      .single();

    if (!site) {
      return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
    }

    const siteAny = site as any;

    // Charger les infos syndic pour le template email
    let syndicDisplayName = siteAny.syndic_company_name || "Syndic";
    let syndicTypeSyndic: "professionnel" | "benevole" | "cooperatif" = "benevole";
    let syndicCartePro: string | null = null;

    if (siteAny.syndic_profile_id) {
      const { data: syndicProfile } = await auth.serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", siteAny.syndic_profile_id)
        .maybeSingle();

      if (syndicProfile) {
        const sp = syndicProfile as any;
        syndicDisplayName = siteAny.syndic_company_name || `${sp.prenom || ""} ${sp.nom || ""}`.trim() || "Syndic";
      }

      const { data: syndicPro } = await auth.serviceClient
        .from("syndic_profiles")
        .select("type_syndic, numero_carte_pro")
        .eq("profile_id", siteAny.syndic_profile_id)
        .maybeSingle();

      if (syndicPro) {
        const spp = syndicPro as any;
        syndicTypeSyndic = spp.type_syndic || "benevole";
        syndicCartePro = spp.numero_carte_pro || null;
      }
    }

    // Charger le nombre de résolutions pour le template email
    const { count: resolutionsCount } = await auth.serviceClient
      .from("copro_resolutions")
      .select("id", { count: "exact", head: true })
      .eq("assembly_id", assembly.id);

    // 3. Dispatcher chaque convocation
    const results: SendResult[] = [];
    const now = new Date().toISOString();

    for (const conv of convocations as any[]) {
      const result: SendResult = {
        convocationId: conv.id,
        recipientName: conv.recipient_name,
        method: conv.delivery_method,
        success: false,
      };

      try {
        if (conv.delivery_method === "email") {
          // --- Email via Resend ---
          if (!conv.recipient_email) {
            result.error = "Pas d'adresse email pour ce copropriétaire";
            results.push(result);
            continue;
          }

          const email = coproAgConvocationEmail({
            recipientName: conv.recipient_name,
            assemblyId: assembly.id,
            assemblyDate: ag.scheduled_at,
            assemblyLocation: ag.location,
            assemblyType: ag.assembly_type === "AGE" ? "extraordinaire" : "ordinaire",
            referenceNumber: ag.reference_number,
            resolutionsCount: resolutionsCount || 0,
            site: {
              name: siteAny.name,
              address: `${siteAny.address_line1}, ${siteAny.postal_code} ${siteAny.city}`,
            },
            syndic: {
              displayName: syndicDisplayName,
              typeSyndic: syndicTypeSyndic,
              numeroCartePro: syndicCartePro,
              emailContact: siteAny.syndic_email,
              telephone: siteAny.syndic_phone,
              adresse: siteAny.syndic_address,
            },
          });

          const emailResult = await sendEmail({
            to: conv.recipient_email,
            subject: email.subject,
            html: email.html,
            tags: [
              { name: "type", value: "copro-ag-convocation" },
              { name: "assembly_id", value: assembly.id },
            ],
            idempotencyKey: `convocation-${conv.id}`,
          });

          if (!emailResult.success) {
            result.error = emailResult.error || "Erreur Resend";
            results.push(result);
            continue;
          }

          // Marquer comme envoyé
          await auth.serviceClient
            .from("copro_convocations")
            .update({ status: "sent", sent_at: now, updated_at: now })
            .eq("id", conv.id);

          result.success = true;

        } else if (conv.delivery_method === "hand_delivered") {
          // --- Remise en main propre ---
          await auth.serviceClient
            .from("copro_convocations")
            .update({ status: "sent", sent_at: now, updated_at: now })
            .eq("id", conv.id);

          result.success = true;

        } else {
          // --- LRAR / postal / LRE ---
          const lrar = getLRARProvider();

          if (!lrar.isConfigured()) {
            result.error = "Service LRAR non configuré (clé API manquante)";
            results.push(result);
            continue;
          }

          // Récupérer le document PDF à envoyer
          let pdfBuffer: Buffer | null = null;

          if (conv.convocation_document_url) {
            try {
              const pdfRes = await fetch(conv.convocation_document_url);
              if (pdfRes.ok) {
                const arrayBuf = await pdfRes.arrayBuffer();
                pdfBuffer = Buffer.from(arrayBuf);
              }
            } catch {
              // URL inaccessible — on continue sans document
            }
          }

          if (!pdfBuffer) {
            result.error = "Aucun document PDF de convocation fourni. Uploadez un PDF avant l'envoi LRAR.";
            results.push(result);
            continue;
          }

          // Construire l'adresse de l'expéditeur (syndic)
          const senderAddress = siteAny.syndic_address || `${siteAny.address_line1}, ${siteAny.postal_code} ${siteAny.city}`;
          const senderParts = parseFrenchAddress(senderAddress);

          // Adresse du destinataire
          const recipientAddress = conv.recipient_address || "";
          const recipientParts = parseFrenchAddress(recipientAddress);

          const sender: LRARSender = {
            name: syndicDisplayName,
            address: senderParts.street,
            postalCode: senderParts.postalCode || siteAny.postal_code || "",
            city: senderParts.city || siteAny.city || "",
          };

          const recipient: LRARRecipient = {
            name: conv.recipient_name,
            address: recipientParts.street,
            postalCode: recipientParts.postalCode || "",
            city: recipientParts.city || "",
          };

          const documents: LRARDocument[] = [
            {
              filename: `convocation-${ag.reference_number || assembly.id}.pdf`,
              content: pdfBuffer,
              mimeType: "application/pdf",
            },
          ];

          const options: LRARSendOptions = {
            deliveryType: conv.delivery_method as LRARSendOptions["deliveryType"],
            acknowledgment: conv.delivery_method !== "postal_simple",
            internalReference: `conv-${conv.id}`,
          };

          const lrarResult = await lrar.sendLetter({ sender, recipient, documents, options });

          // Mettre à jour avec tracking
          await auth.serviceClient
            .from("copro_convocations")
            .update({
              status: "sent",
              sent_at: now,
              tracking_number: lrarResult.trackingNumber || null,
              updated_at: now,
            })
            .eq("id", conv.id);

          result.success = true;
          result.trackingNumber = lrarResult.trackingNumber;
        }
      } catch (err) {
        result.error = err instanceof Error ? err.message : "Erreur inattendue";
      }

      results.push(result);
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: results.length,
      sent,
      failed,
      results,
    });
  } catch (error) {
    console.error("[send-convocations:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Parse une adresse française libre en composants (rue, CP, ville).
 * Heuristique simple : cherche un code postal 5 chiffres.
 */
function parseFrenchAddress(raw: string): {
  street: string;
  postalCode: string;
  city: string;
} {
  const match = raw.match(/(\d{5})\s+(.+)/);
  if (match) {
    const beforeCp = raw.substring(0, raw.indexOf(match[1])).replace(/,\s*$/, "").trim();
    return {
      street: beforeCp || raw,
      postalCode: match[1],
      city: match[2].trim(),
    };
  }
  return { street: raw, postalCode: "", city: "" };
}

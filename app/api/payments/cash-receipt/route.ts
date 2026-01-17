export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/cash-receipt
 * Crée un reçu de paiement en espèces avec signatures
 */

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const {
      invoice_id,
      amount,
      owner_signature,
      tenant_signature,
      owner_signed_at,
      tenant_signed_at,
      geolocation,
      device_info,
      notes,
    } = body;

    // Validation
    if (!invoice_id || !amount || !owner_signature || !tenant_signature) {
      return NextResponse.json(
        { error: "Données manquantes: invoice_id, amount, signatures requis" },
        { status: 400 }
      );
    }

    // Vérifier le profil propriétaire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut créer un reçu espèces" },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();

    // Récupérer la facture avec les infos liées
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select(`
        *,
        tenant:profiles!invoices_tenant_id_fkey(id, prenom, nom, user_id),
        lease:leases(
          id,
          property_id,
          property:properties(id, adresse_complete, owner_id)
        )
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que la facture appartient au propriétaire
    if (invoice.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Cette facture ne vous appartient pas" },
        { status: 403 }
      );
    }

    if (invoice.statut === "paid") {
      return NextResponse.json(
        { error: "Cette facture est déjà payée" },
        { status: 400 }
      );
    }

    // Convertir montant en lettres
    const amountWords = convertAmountToWords(amount);

    // Créer le hash d'intégrité
    const documentData = JSON.stringify({
      invoice_id,
      amount,
      owner_id: profile.id,
      tenant_id: invoice.tenant_id,
      owner_name: `${profile.prenom} ${profile.nom}`,
      tenant_name: `${invoice.tenant.prenom} ${invoice.tenant.nom}`,
      owner_signed_at,
      tenant_signed_at,
      geolocation,
      timestamp: new Date().toISOString(),
    });
    const documentHash = crypto
      .createHash("sha256")
      .update(documentData)
      .digest("hex");

    // Créer le paiement
    const { data: payment, error: paymentError } = await serviceClient
      .from("payments")
      .insert({
        invoice_id,
        montant: amount,
        moyen: "especes",
        date_paiement: new Date().toISOString().split("T")[0],
        statut: "succeeded",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Erreur création paiement:", paymentError);
      throw new Error("Erreur lors de la création du paiement");
    }

    // Créer le reçu espèces
    const { data: receipt, error: receiptError } = await serviceClient
      .from("cash_receipts")
      .insert({
        invoice_id,
        payment_id: payment.id,
        owner_id: profile.id,
        tenant_id: invoice.tenant_id,
        property_id: invoice.lease?.property_id,
        amount,
        amount_words: amountWords,
        owner_signature,
        tenant_signature,
        owner_signed_at: owner_signed_at || new Date().toISOString(),
        tenant_signed_at: tenant_signed_at || new Date().toISOString(),
        latitude: geolocation?.lat,
        longitude: geolocation?.lng,
        device_info: device_info || {},
        document_hash: documentHash,
        periode: invoice.periode,
        notes,
        status: "signed",
      })
      .select("*, receipt_number")
      .single();

    if (receiptError) {
      console.error("Erreur création reçu:", receiptError);
      // Rollback du paiement
      await serviceClient.from("payments").delete().eq("id", payment.id);
      throw new Error("Erreur lors de la création du reçu");
    }

    // Mettre à jour la facture
    const { error: updateError } = await serviceClient
      .from("invoices")
      .update({ statut: "paid" })
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Erreur mise à jour facture:", updateError);
    }

    // Générer le PDF (appel asynchrone)
    let pdfUrl = null;
    try {
      const pdfResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/pdf/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: "cash_receipt",
            data: {
              receipt_id: receipt.id,
              receipt_number: receipt.receipt_number,
              owner_name: `${profile.prenom} ${profile.nom}`,
              tenant_name: `${invoice.tenant.prenom} ${invoice.tenant.nom}`,
              property_address: invoice.lease?.property?.adresse_complete,
              amount,
              amount_words: amountWords,
              periode: invoice.periode,
              owner_signature,
              tenant_signature,
              owner_signed_at: receipt.owner_signed_at,
              tenant_signed_at: receipt.tenant_signed_at,
              geolocation,
              document_hash: documentHash,
            },
          }),
        }
      );

      if (pdfResponse.ok) {
        const pdfData = await pdfResponse.json();
        pdfUrl = pdfData.url;

        // Mettre à jour le reçu avec l'URL du PDF
        await serviceClient
          .from("cash_receipts")
          .update({
            pdf_url: pdfUrl,
            pdf_path: pdfData.path,
            pdf_generated_at: new Date().toISOString(),
            status: "sent",
          })
          .eq("id", receipt.id);
      }
    } catch (pdfError) {
      console.error("Erreur génération PDF:", pdfError);
      // Non bloquant
    }

    // Créer les notifications
    await Promise.all([
      // Notification propriétaire
      serviceClient.from("notifications").insert({
        user_id: user.id,
        type: "cash_receipt_created",
        title: "Reçu espèces créé",
        message: `Reçu ${receipt.receipt_number} de ${amount}€ pour ${invoice.tenant.prenom} ${invoice.tenant.nom}.`,
        data: { receipt_id: receipt.id, invoice_id, payment_id: payment.id },
      }),
      // Notification locataire
      serviceClient.from("notifications").insert({
        user_id: invoice.tenant.user_id,
        type: "cash_payment_confirmed",
        title: "Paiement confirmé",
        message: `Votre paiement de ${amount}€ en espèces a été confirmé. Reçu: ${receipt.receipt_number}`,
        data: { receipt_id: receipt.id, invoice_id },
      }),
    ]);

    // Audit log
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "cash_receipt_created",
      entity_type: "cash_receipt",
      entity_id: receipt.id,
      metadata: {
        invoice_id,
        payment_id: payment.id,
        amount,
        document_hash: documentHash,
        has_geolocation: !!geolocation,
      },
    });

    return NextResponse.json({
      success: true,
      receipt_id: receipt.id,
      receipt_number: receipt.receipt_number,
      payment_id: payment.id,
      pdf_url: pdfUrl,
      document_hash: documentHash,
    });
  } catch (error: unknown) {
    console.error("Erreur création reçu espèces:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Convertit un montant en lettres (français)
 */
function convertAmountToWords(amount: number): string {
  const units = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];
  const tens = [
    "",
    "",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante",
    "quatre-vingt",
    "quatre-vingt",
  ];

  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  function convertLessThanHundred(n: number): string {
    if (n < 20) return units[n];

    const t = Math.floor(n / 10);
    const u = n % 10;

    if (t === 7 || t === 9) {
      return tens[t] + "-" + units[10 + u];
    } else if (u === 0) {
      return tens[t] + (t === 8 ? "s" : "");
    } else if (u === 1 && t !== 8) {
      return tens[t] + " et un";
    } else {
      return tens[t] + "-" + units[u];
    }
  }

  function convertLessThanThousand(n: number): string {
    if (n < 100) return convertLessThanHundred(n);

    const h = Math.floor(n / 100);
    const remainder = n % 100;

    let result = h === 1 ? "cent" : units[h] + " cent";
    if (remainder === 0 && h > 1) result += "s";
    else if (remainder > 0) result += " " + convertLessThanHundred(remainder);

    return result;
  }

  function convertNumber(n: number): string {
    if (n === 0) return "zéro";
    if (n < 1000) return convertLessThanThousand(n);

    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;

    let result = thousands === 1 ? "mille" : convertLessThanThousand(thousands) + " mille";
    if (remainder > 0) result += " " + convertLessThanThousand(remainder);

    return result;
  }

  let result = convertNumber(euros);
  result += euros > 1 ? " euros" : " euro";

  if (cents > 0) {
    result += " et " + cents + " centime" + (cents > 1 ? "s" : "");
  }

  // Capitaliser la première lettre
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * GET /api/payments/cash-receipt
 * Liste les reçus espèces
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoice_id");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let query = supabase
      .from("cash_receipts")
      .select(`
        *,
        invoice:invoices(id, periode, montant_total),
        payment:payments(id, montant, date_paiement)
      `)
      .order("created_at", { ascending: false });

    // Filtrer selon le rôle
    if (profile.role === "owner") {
      query = query.eq("owner_id", profile.id);
    } else if (profile.role === "tenant") {
      query = query.eq("tenant_id", profile.id);
    }

    // Filtrer par facture si spécifié
    if (invoiceId) {
      query = query.eq("invoice_id", invoiceId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erreur récupération reçus:", error);
      throw error;
    }

    return NextResponse.json({ receipts: data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


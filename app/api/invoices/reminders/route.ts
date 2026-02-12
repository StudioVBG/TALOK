export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import {
  detectLateInvoices,
  getReminderEmailContent,
  type LateInvoice,
  type ReminderResult,
} from "@/lib/services/payment-reminder.service";

/**
 * GET /api/invoices/reminders
 * Retourne les factures en retard avec leur niveau de relance.
 * Utilise les données existantes (invoices, leases, lease_signers).
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) throw new ApiError(401, "Non authentifié");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) throw new ApiError(500, "Configuration manquante");

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Récupérer le profil courant
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(404, "Profil non trouvé");
    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    // Récupérer les propriétés du propriétaire
    const { data: properties } = await serviceClient
      .from("properties")
      .select("id")
      .eq("owner_id", profile.id);

    const propertyIds = (properties || []).map((p: any) => p.id);
    if (propertyIds.length === 0) {
      return NextResponse.json({ late_invoices: [], total: 0 });
    }

    // Récupérer les baux actifs
    const { data: leases } = await serviceClient
      .from("leases")
      .select("id, type_bail, property:properties(adresse_complete)")
      .in("property_id", propertyIds)
      .in("statut", ["active", "fully_signed"]);

    const leaseIds = (leases || []).map((l: any) => l.id);
    if (leaseIds.length === 0) {
      return NextResponse.json({ late_invoices: [], total: 0 });
    }

    // Récupérer les factures impayées
    const { data: invoices } = await serviceClient
      .from("invoices")
      .select("id, lease_id, montant, due_date, statut")
      .in("lease_id", leaseIds)
      .in("statut", ["sent", "draft", "late", "pending"])
      .not("due_date", "is", null);

    // Récupérer les signataires pour les noms/emails
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("lease_id, role, profile:profiles(prenom, nom, email)")
      .in("lease_id", leaseIds);

    // Grouper par lease_id
    const signersMap: Record<string, any[]> = {};
    for (const s of signers || []) {
      if (!signersMap[s.lease_id]) signersMap[s.lease_id] = [];
      signersMap[s.lease_id].push(s);
    }

    const lateInvoices = detectLateInvoices(
      invoices || [],
      leases || [],
      signersMap
    );

    return NextResponse.json({
      late_invoices: lateInvoices,
      total: lateInvoices.length,
      summary: {
        amiable: lateInvoices.filter(i => i.reminder_level === "amiable").length,
        formelle: lateInvoices.filter(i => i.reminder_level === "formelle").length,
        mise_en_demeure: lateInvoices.filter(i => i.reminder_level === "mise_en_demeure").length,
        total_amount: lateInvoices.reduce((sum, i) => sum + i.montant, 0),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/invoices/reminders
 * Envoie une relance pour une facture spécifique.
 * Body: { invoice_id: string, level?: ReminderLevel }
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) throw new ApiError(401, "Non authentifié");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) throw new ApiError(500, "Configuration manquante");

    const body = await request.json();
    const { invoice_id, level } = body;

    if (!invoice_id) throw new ApiError(400, "invoice_id requis");

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Vérifier le profil
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Récupérer la facture avec le bail et la propriété
    const { data: invoice } = await serviceClient
      .from("invoices")
      .select(`
        id, lease_id, montant, due_date, statut,
        lease:leases(
          id, type_bail, property_id,
          property:properties(adresse_complete, owner_id)
        )
      `)
      .eq("id", invoice_id)
      .single();

    if (!invoice) throw new ApiError(404, "Facture non trouvée");

    // Vérifier que le propriétaire est bien le propriétaire du bien
    const leaseData = invoice.lease as any;
    if (profile.role !== "admin" && leaseData?.property?.owner_id !== profile.id) {
      throw new ApiError(403, "Vous n'êtes pas propriétaire de ce bien");
    }

    // Récupérer le locataire
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("role, profile:profiles(prenom, nom, email)")
      .eq("lease_id", invoice.lease_id)
      .in("role", ["locataire_principal", "colocataire"]);

    const tenant = (signers || []).find((s: any) => s.profile?.email);
    if (!tenant?.profile?.email) {
      throw new ApiError(422, "Email du locataire non disponible");
    }

    // Calculer le niveau de relance
    const dueDate = new Date(invoice.due_date);
    const daysLate = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const reminderLevel = level || (daysLate >= 30 ? "mise_en_demeure" : daysLate >= 15 ? "formelle" : "amiable");

    const lateInvoice: LateInvoice = {
      id: invoice.id,
      lease_id: invoice.lease_id,
      montant: invoice.montant,
      due_date: invoice.due_date,
      days_late: daysLate,
      reminder_level: reminderLevel,
      tenant_name: `${tenant.profile.prenom || ""} ${tenant.profile.nom || ""}`.trim(),
      tenant_email: tenant.profile.email,
      property_address: leaseData?.property?.adresse_complete || "",
      lease_type: leaseData?.type_bail || "nu",
    };

    const emailContent = getReminderEmailContent(reminderLevel, lateInvoice);

    // Envoyer l'email via le service email existant
    const result: ReminderResult = {
      invoice_id,
      level: reminderLevel,
      sent: false,
    };

    try {
      const { sendEmail } = await import("@/lib/services/email-service");
      await sendEmail({
        to: tenant.profile.email,
        subject: emailContent.subject,
        text: emailContent.body,
      });
      result.sent = true;

      // Mettre à jour le statut de la facture si elle n'est pas déjà marquée "late"
      if (invoice.statut !== "late") {
        await serviceClient
          .from("invoices")
          .update({ statut: "late" })
          .eq("id", invoice_id);
      }
    } catch (emailErr: any) {
      result.error = emailErr.message || "Erreur lors de l'envoi";
    }

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

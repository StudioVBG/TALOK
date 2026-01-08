export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * CRON Job: Notifications automatiques
 * - Rappels de paiement (J-5, J-1, J+1, J+7)
 * - Baux expirant bientôt (J-90, J-30, J-7)
 * - Résumés hebdomadaires
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Vérifier le secret pour autoriser l'appel
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    payment_reminders: 0,
    lease_expiry_reminders: 0,
    overdue_reminders: 0,
    errors: [] as string[],
  };

  try {
    // =====================================================
    // 1. RAPPELS DE PAIEMENT À VENIR (J-5, J-1)
    // =====================================================
    const today = new Date();
    const in5Days = new Date(today);
    in5Days.setDate(today.getDate() + 5);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Factures dues dans 5 jours
    const { data: dueIn5Days } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        tenant_id,
        lease:leases (
          properties (
            adresse_complete,
            ville
          )
        ),
        tenant:profiles!invoices_tenant_id_fkey (
          user_id,
          prenom,
          nom
        )
      `)
      .eq("statut", "sent")
      .gte("created_at", in5Days.toISOString().split("T")[0])
      .lt("created_at", new Date(in5Days.getTime() + 86400000).toISOString().split("T")[0]);

    for (const invoice of dueIn5Days || []) {
      if (!invoice.tenant?.user_id) continue;
      
      try {
        await supabase.rpc("create_notification", {
          p_user_id: invoice.tenant.user_id,
          p_type: "payment_due",
          p_title: "Rappel : loyer à payer dans 5 jours",
          p_message: `Votre loyer de ${invoice.montant_total}€ pour ${invoice.periode} est dû dans 5 jours.`,
          p_action_url: "/tenant/payments",
          p_priority: "normal",
          p_metadata: { invoice_id: invoice.id },
        });
        results.payment_reminders++;
      } catch (e: any) {
        results.errors.push(`Invoice ${invoice.id}: ${e.message}`);
      }
    }

    // Factures dues demain
    const { data: dueTomorrow } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        tenant:profiles!invoices_tenant_id_fkey (
          user_id
        )
      `)
      .eq("statut", "sent")
      .gte("created_at", tomorrow.toISOString().split("T")[0])
      .lt("created_at", new Date(tomorrow.getTime() + 86400000).toISOString().split("T")[0]);

    for (const invoice of dueTomorrow || []) {
      if (!invoice.tenant?.user_id) continue;
      
      try {
        await supabase.rpc("create_notification", {
          p_user_id: invoice.tenant.user_id,
          p_type: "payment_due",
          p_title: "⚠️ Loyer à payer demain",
          p_message: `Votre loyer de ${invoice.montant_total}€ est dû demain.`,
          p_action_url: "/tenant/payments",
          p_priority: "high",
          p_metadata: { invoice_id: invoice.id },
        });
        results.payment_reminders++;
      } catch (e: any) {
        results.errors.push(`Invoice ${invoice.id}: ${e.message}`);
      }
    }

    // =====================================================
    // 2. LOYERS EN RETARD (J+1, J+7)
    // =====================================================
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    // En retard depuis hier (premier rappel)
    const { data: overdueSinceYesterday } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        owner_id,
        tenant_id,
        tenant:profiles!invoices_tenant_id_fkey (user_id),
        owner:profiles!invoices_owner_id_fkey (user_id)
      `)
      .eq("statut", "late")
      .gte("updated_at", yesterday.toISOString().split("T")[0])
      .lt("updated_at", today.toISOString().split("T")[0]);

    for (const invoice of overdueSinceYesterday || []) {
      // Notifier le locataire
      if (invoice.tenant?.user_id) {
        try {
          await supabase.rpc("create_notification", {
            p_user_id: invoice.tenant.user_id,
            p_type: "payment_overdue",
            p_title: "🚨 Loyer en retard",
            p_message: `Votre loyer de ${invoice.montant_total}€ est en retard de paiement.`,
            p_action_url: "/tenant/payments",
            p_priority: "urgent",
            p_metadata: { invoice_id: invoice.id },
          });
          results.overdue_reminders++;
        } catch (e: any) {
          results.errors.push(`Overdue tenant ${invoice.id}: ${e.message}`);
        }
      }

      // Notifier le propriétaire
      if (invoice.owner?.user_id) {
        try {
          await supabase.rpc("create_notification", {
            p_user_id: invoice.owner.user_id,
            p_type: "payment_overdue",
            p_title: "Loyer impayé",
            p_message: `Un loyer de ${invoice.montant_total}€ est en retard de paiement.`,
            p_action_url: "/owner/money",
            p_priority: "high",
            p_metadata: { invoice_id: invoice.id },
          });
          results.overdue_reminders++;
        } catch (e: any) {
          results.errors.push(`Overdue owner ${invoice.id}: ${e.message}`);
        }
      }
    }

    // =====================================================
    // 3. BAUX EXPIRANT BIENTÔT (J-90, J-30, J-7)
    // =====================================================
    const in90Days = new Date(today);
    in90Days.setDate(today.getDate() + 90);
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const checkDates = [
      { date: in90Days, days: 90, priority: "normal" as const },
      { date: in30Days, days: 30, priority: "high" as const },
      { date: in7Days, days: 7, priority: "urgent" as const },
    ];

    for (const check of checkDates) {
      const dateStr = check.date.toISOString().split("T")[0];
      
      const { data: expiringLeases } = await supabase
        .from("leases")
        .select(`
          id,
          date_fin,
          properties (
            adresse_complete,
            ville,
            owner_id
          )
        `)
        .eq("statut", "active")
        .eq("date_fin", dateStr);

      for (const lease of expiringLeases || []) {
        // Récupérer le propriétaire
        const { data: owner } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", lease.properties?.owner_id)
          .single();

        if (owner?.user_id) {
          try {
            await supabase.rpc("create_notification", {
              p_user_id: owner.user_id,
              p_type: "lease_expiring",
              p_title: `Bail expire dans ${check.days} jours`,
              p_message: `Le bail pour ${lease.properties?.adresse_complete} expire le ${lease.date_fin}.`,
              p_action_url: `/owner/leases/${lease.id}`,
              p_priority: check.priority,
              p_metadata: { lease_id: lease.id, days_remaining: check.days },
            });
            results.lease_expiry_reminders++;
          } catch (e: any) {
            results.errors.push(`Lease expiry ${lease.id}: ${e.message}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Cron notifications error:", error);
    return NextResponse.json(
      { error: error.message, results },
      { status: 500 }
    );
  }
}


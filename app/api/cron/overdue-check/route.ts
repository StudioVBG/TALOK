export const runtime = 'nodejs';

/**
 * CRON Job: Détection des retards, calcul pénalités légales, mise à jour statuts
 *
 * Ce job s'exécute quotidiennement à 9h UTC
 * Il détecte les factures en retard, calcule les pénalités légales (loi 1989),
 * enregistre les late_fees, et met à jour les statuts des factures.
 *
 * Machine à états :
 *   sent → overdue (grace_period_days écoulé, non payée)
 *   late → overdue (idem)
 *   overdue → unpaid (30+ jours sans paiement)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "development") return true;
  return authHeader === `Bearer ${cronSecret}`;
}

interface OverdueResult {
  total_checked: number;
  marked_overdue: number;
  marked_unpaid: number;
  late_fees_calculated: number;
  errors: string[];
}

export async function GET(request: NextRequest) {

  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const result: OverdueResult = {
    total_checked: 0,
    marked_overdue: 0,
    marked_unpaid: 0,
    late_fees_calculated: 0,
    errors: [],
  };

  try {
    // 1. Récupérer toutes les factures non payées avec date_echeance dépassée
    const { data: overdueInvoices, error } = await supabase
      .from("invoices")
      .select(`
        id,
        lease_id,
        tenant_id,
        owner_id,
        periode,
        montant_total,
        date_echeance,
        statut,
        lease:leases (
          id,
          grace_period_days,
          late_fee_rate,
          property:properties (
            adresse_complete,
            ville
          )
        )
      `)
      .in("statut", ["sent", "late", "overdue"])
      .not("date_echeance", "is", null)
      .lte("date_echeance", today);

    if (error) throw error;
    if (!overdueInvoices || overdueInvoices.length === 0) {
      return NextResponse.json({ success: true, result });
    }

    result.total_checked = overdueInvoices.length;

    for (const invoice of overdueInvoices) {
      try {
        const dueDate = new Date(invoice.date_echeance!);
        const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const gracePeriod = (invoice.lease as any)?.grace_period_days ?? 3;
        const lateFeeRate = Number((invoice.lease as any)?.late_fee_rate ?? 0.00274);

        // Transition sent/late → overdue (après grace period)
        if ((invoice.statut === "sent" || invoice.statut === "late") && daysLate > gracePeriod) {
          await supabase
            .from("invoices")
            .update({ statut: "overdue", updated_at: now.toISOString() })
            .eq("id", invoice.id);

          result.marked_overdue++;

          // Notifier owner
          await supabase.from("outbox").insert({
            event_type: "Invoice.Overdue",
            payload: {
              invoice_id: invoice.id,
              tenant_id: invoice.tenant_id,
              owner_id: invoice.owner_id,
              montant_total: invoice.montant_total,
              periode: invoice.periode,
              days_late: daysLate,
              property_address: (invoice.lease as any)?.property?.adresse_complete || "",
            },
          });
        }

        // Transition overdue → unpaid (après 30 jours)
        if (invoice.statut === "overdue" && daysLate >= 30) {
          await supabase
            .from("invoices")
            .update({ statut: "unpaid", updated_at: now.toISOString() })
            .eq("id", invoice.id);

          result.marked_unpaid++;

          // Alerte critique owner
          await supabase.from("outbox").insert({
            event_type: "Invoice.Unpaid",
            payload: {
              invoice_id: invoice.id,
              tenant_id: invoice.tenant_id,
              owner_id: invoice.owner_id,
              montant_total: invoice.montant_total,
              periode: invoice.periode,
              days_late: daysLate,
              property_address: (invoice.lease as any)?.property?.adresse_complete || "",
            },
          });
        }

        // Calcul des pénalités légales (loi 6 juillet 1989)
        // Pénalité = montant_dû × taux_journalier × jours_retard
        if (daysLate > gracePeriod) {
          const penaltyAmount = Math.round(Number(invoice.montant_total) * lateFeeRate * daysLate * 100) / 100;

          if (penaltyAmount > 0) {
            // Vérifier si une pénalité existe déjà pour aujourd'hui
            const { data: existingFee } = await (supabase.from("late_fees") as any)
              .select("id")
              .eq("invoice_id", invoice.id)
              .gte("calculated_at", today + "T00:00:00")
              .maybeSingle();

            if (!existingFee) {
              await (supabase.from("late_fees") as any).insert({
                invoice_id: invoice.id,
                amount: penaltyAmount,
                rate: lateFeeRate,
                days_late: daysLate,
                calculated_at: now.toISOString(),
              });
              result.late_fees_calculated++;
            }
          }
        }

        // Enregistrer la relance dans payment_reminders
        if (daysLate > gracePeriod) {
          let reminderType: string;
          if (daysLate <= 7) reminderType = "friendly";
          else if (daysLate <= 14) reminderType = "reminder";
          else if (daysLate <= 21) reminderType = "urgent";
          else if (daysLate <= 30) reminderType = "formal_notice";
          else reminderType = "final";

          // Vérifier qu'on n'a pas déjà envoyé ce type de relance
          const { data: existingReminder } = await (supabase.from("payment_reminders") as any)
            .select("id")
            .eq("invoice_id", invoice.id)
            .eq("reminder_type", reminderType)
            .maybeSingle();

          if (!existingReminder) {
            await (supabase.from("payment_reminders") as any).insert({
              invoice_id: invoice.id,
              tenant_id: invoice.tenant_id,
              reminder_type: reminderType,
              channel: reminderType === "formal_notice" || reminderType === "final" ? "lrec" : "email",
              metadata: { days_late: daysLate, montant_total: invoice.montant_total },
            });
          }
        }

      } catch (invoiceError: any) {
        console.error(`[CRON] Error processing invoice ${invoice.id}:`, invoiceError);
        result.errors.push(`Invoice ${invoice.id}: ${invoiceError.message}`);
      }
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "overdue_check",
      entity_type: "system",
      entity_id: today,
      metadata: {
        date: today,
        ...result,
      },
    } as any);


    return NextResponse.json({
      success: true,
      message: `Overdue check: ${result.marked_overdue} overdue, ${result.marked_unpaid} unpaid, ${result.late_fees_calculated} fees calculated`,
      result,
      timestamp: now.toISOString(),
    });

  } catch (error: unknown) {
    console.error("[CRON] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: extractErrorMessage(error),
        result,
      },
      { status: 500 }
    );
  }
}

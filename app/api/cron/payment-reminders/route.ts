export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendPaymentReminder, sendOwnerPaymentAlert } from "@/lib/emails/resend.service";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";
import { notifyPaymentLate } from "@/lib/services/notification-service";
import { NextResponse } from "next/server";

// ── Schedule de relance (source de vérité) ──────────────────────────

type ReminderType = "gentle" | "firm" | "urgent" | "mise-en-demeure";

interface ReminderStep {
  level: number;
  minDaysLate: number;
  type: ReminderType;
  notifyOwner: boolean;
}

const REMINDER_SCHEDULE: readonly ReminderStep[] = [
  { level: 1, minDaysLate: 1, type: "gentle", notifyOwner: false },
  { level: 2, minDaysLate: 3, type: "firm", notifyOwner: false },
  { level: 3, minDaysLate: 7, type: "urgent", notifyOwner: true },
  { level: 4, minDaysLate: 15, type: "mise-en-demeure", notifyOwner: true },
] as const;

/** Minimum 24 h entre deux relances pour la même facture */
const MIN_HOURS_BETWEEN_REMINDERS = 24;

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Détermine le prochain niveau de relance à envoyer.
 * Renvoie le plus haut niveau éligible (ex: à J+10 on envoie "firm"
 * si la facture n'a encore eu que 1 relance, pas "gentle").
 */
function getNextReminderLevel(
  daysLate: number,
  currentCount: number
): ReminderStep | null {
  for (let i = REMINDER_SCHEDULE.length - 1; i >= 0; i--) {
    const step = REMINDER_SCHEDULE[i];
    if (daysLate >= step.minDaysLate && currentCount < step.level) {
      return step;
    }
  }
  return null;
}

/** Vérifie que la dernière relance date de > 24 h */
function isAntiSpamOk(lastReminderAt: string | null): boolean {
  if (!lastReminderAt) return true;
  const last = new Date(lastReminderAt).getTime();
  const now = Date.now();
  return now - last >= MIN_HOURS_BETWEEN_REMINDERS * 60 * 60 * 1000;
}

/** Formatte une date en français lisible */
function formatDateFR(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Route ───────────────────────────────────────────────────────────

/**
 * GET /api/cron/payment-reminders
 *
 * Cron quotidien — envoie les relances impayés via Resend.
 *
 * Schedule : J+1 gentle, J+3 firm, J+7 urgent, J+15 mise-en-demeure.
 * Anti-spam : 24 h minimum entre deux relances par facture.
 * Idempotent : relancer 2× dans la même journée ne renvoie pas.
 *
 * Query params :
 *   ?dry_run=true  → retourne ce qui SERAIT envoyé, sans envoyer
 *
 * Header requis : Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    // ── Auth CRON ──
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    const supabase = createServiceRoleClient();
    const now = new Date();

    // ── 1. Charger toutes les factures impayées dont l'échéance est passée ──
    const { data: invoices, error: queryErr } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        date_echeance,
        due_date,
        created_at,
        statut,
        reminder_count,
        last_reminder_at,
        tenant_id,
        owner_id,
        lease_id,
        lease:leases!inner(
          id,
          property:properties!inner(
            owner_id,
            adresse_complete,
            ville
          )
        )
      `)
      .in("statut", ["sent", "late", "overdue", "unpaid", "reminder_sent"])
      .not("statut", "in", '("paid","cancelled","draft")');

    if (queryErr) throw queryErr;
    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        success: true,
        dry_run: dryRun,
        timestamp: now.toISOString(),
        stats: { processed: 0, sent: 0, skipped: 0, errors: 0 },
        details: [],
      });
    }

    // ── 2. Traiter chaque facture ──
    const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 };
    const details: Array<{
      invoice_id: string;
      action: string;
      level?: string;
      days_late?: number;
      reason?: string;
    }> = [];

    for (const rawInvoice of invoices) {
      const inv = rawInvoice as any;
      stats.processed++;

      try {
        // Calculer les jours de retard
        const dueDate = inv.date_echeance || inv.due_date;
        const referenceDate = dueDate
          ? new Date(dueDate)
          : new Date(inv.created_at);
        const daysLate = Math.max(
          0,
          Math.floor(
            (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        if (daysLate < 1) {
          stats.skipped++;
          details.push({
            invoice_id: inv.id,
            action: "skipped",
            days_late: daysLate,
            reason: "not_yet_overdue",
          });
          continue;
        }

        // Déterminer le prochain niveau
        const currentCount = inv.reminder_count || 0;
        const nextStep = getNextReminderLevel(daysLate, currentCount);

        if (!nextStep) {
          stats.skipped++;
          details.push({
            invoice_id: inv.id,
            action: "skipped",
            days_late: daysLate,
            reason: "all_levels_sent",
          });
          continue;
        }

        // Anti-spam
        if (!isAntiSpamOk(inv.last_reminder_at)) {
          stats.skipped++;
          details.push({
            invoice_id: inv.id,
            action: "skipped",
            level: nextStep.type,
            days_late: daysLate,
            reason: "anti_spam_24h",
          });
          continue;
        }

        // ── Dry run : on s'arrête ici ──
        if (dryRun) {
          stats.sent++;
          details.push({
            invoice_id: inv.id,
            action: "would_send",
            level: nextStep.type,
            days_late: daysLate,
          });
          continue;
        }

        // ── Charger le profil du locataire + email ──
        const { data: tenantProfile } = await supabase
          .from("profiles")
          .select("id, user_id, prenom, nom")
          .eq("id", inv.tenant_id)
          .single();

        if (!tenantProfile?.user_id) {
          stats.errors++;
          details.push({
            invoice_id: inv.id,
            action: "error",
            reason: "tenant_profile_not_found",
          });
          continue;
        }

        const { data: tenantAuth } =
          await supabase.auth.admin.getUserById(tenantProfile.user_id);
        const tenantEmail = tenantAuth?.user?.email;

        if (!tenantEmail) {
          stats.errors++;
          details.push({
            invoice_id: inv.id,
            action: "error",
            reason: "tenant_email_not_found",
          });
          continue;
        }

        const tenantName =
          [tenantProfile.prenom, tenantProfile.nom]
            .filter(Boolean)
            .join(" ") || "Locataire";

        const dueDateFormatted = formatDateFR(referenceDate);

        // ── 3a. Envoyer l'email au locataire ──
        const emailResult = await sendPaymentReminder({
          tenantEmail,
          tenantName,
          amount: inv.montant_total,
          dueDate: dueDateFormatted,
          daysLate,
          invoiceId: inv.id,
        });

        if (!emailResult.success) {
          console.error(
            `[CRON] payment-reminders email failed for ${inv.id}:`,
            emailResult.error
          );
          stats.errors++;
          details.push({
            invoice_id: inv.id,
            action: "error",
            level: nextStep.type,
            reason: `email_failed: ${emailResult.error}`,
          });
          continue;
        }

        // ── 3b. Notification in-app au locataire ──
        try {
          await notifyPaymentLate(
            tenantProfile.id,
            inv.montant_total,
            daysLate,
            inv.id
          );
        } catch (notifErr) {
          console.warn(
            `[CRON] notifyPaymentLate failed for ${tenantProfile.id}:`,
            notifErr
          );
        }

        // ── 3c. Alerte proprio (J+7 urgent, J+15 mise-en-demeure) ──
        if (nextStep.notifyOwner) {
          try {
            const ownerId = inv.owner_id || inv.lease?.property?.owner_id;

            if (ownerId) {
              const { data: ownerProfile } = await supabase
                .from("profiles")
                .select("id, user_id, prenom, nom")
                .eq("id", ownerId)
                .single();

              if (ownerProfile?.user_id) {
                const { data: ownerAuth } =
                  await supabase.auth.admin.getUserById(ownerProfile.user_id);
                const ownerEmail = ownerAuth?.user?.email;

                if (ownerEmail) {
                  const ownerName =
                    [ownerProfile.prenom, ownerProfile.nom]
                      .filter(Boolean)
                      .join(" ") || "Propriétaire";

                  const propertyAddress =
                    inv.lease?.property?.adresse_complete ||
                    inv.lease?.property?.ville ||
                    "votre logement";

                  await sendOwnerPaymentAlert({
                    ownerEmail,
                    ownerName,
                    tenantName,
                    propertyAddress,
                    amount: inv.montant_total,
                    daysLate,
                    period: inv.periode,
                    invoiceId: inv.id,
                    level:
                      nextStep.type === "mise-en-demeure"
                        ? "mise-en-demeure"
                        : "urgent",
                  });
                }
              }
            }
          } catch (ownerErr) {
            console.warn(
              `[CRON] owner notification failed for invoice ${inv.id}:`,
              ownerErr
            );
          }
        }

        // ── 4. Mettre à jour la facture ──
        const newCount = currentCount + 1;
        const updatePayload: Record<string, any> = {
          reminder_count: newCount,
          last_reminder_at: now.toISOString(),
        };

        // Escalade de statut : sent → late dès la première relance
        if (inv.statut === "sent") {
          updatePayload.statut = "late";
        }

        await supabase
          .from("invoices")
          .update(updatePayload)
          .eq("id", inv.id);

        // ── 5. Outbox pour notifications in-app ──
        await supabase.from("outbox").insert({
          event_type: "Payment.Reminder",
          payload: {
            invoice_id: inv.id,
            lease_id: inv.lease_id,
            tenant_id: tenantProfile.user_id,
            amount: inv.montant_total,
            month: inv.periode,
            reminder_level: nextStep.type,
            days_late: daysLate,
          },
        } as any);

        // ── 6. Audit log ──
        await supabase.from("audit_log").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          action: "payment_reminder_sent",
          entity_type: "invoice",
          entity_id: inv.id,
          metadata: {
            lease_id: inv.lease_id,
            amount: inv.montant_total,
            days_late: daysLate,
            reminder_count: newCount,
            level: nextStep.type,
            tenant_email: tenantEmail,
            cron: true,
          },
        } as any);

        stats.sent++;
        details.push({
          invoice_id: inv.id,
          action: "sent",
          level: nextStep.type,
          days_late: daysLate,
        });
      } catch (err) {
        console.error(
          `[CRON] payment-reminders failed for ${inv.id}:`,
          extractErrorMessage(err)
        );
        stats.errors++;
        details.push({
          invoice_id: inv.id,
          action: "error",
          reason: extractErrorMessage(err),
        });
      }
    }

    console.log(
      `[CRON] payment-reminders done: ${stats.sent} sent, ${stats.skipped} skipped, ${stats.errors} errors (${stats.processed} processed)${dryRun ? " [DRY RUN]" : ""}`
    );

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      timestamp: now.toISOString(),
      stats,
      details,
    });
  } catch (error: unknown) {
    const message = extractErrorMessage(error);
    console.error("[CRON] payment-reminders fatal:", message, error);
    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

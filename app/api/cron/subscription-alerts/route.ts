export const runtime = 'nodejs';

/**
 * GET /api/cron/subscription-alerts
 * Cron job pour alerter des abonnements arrivant à expiration
 * Configuré pour s'exécuter tous les jours à 10h
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { addDays, differenceInDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { sendEmail } from "@/lib/emails/resend.service";
import { emailTemplates } from "@/lib/emails/templates";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return process.env.NODE_ENV === "development";
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date();

  const results = {
    processed: 0,
    trial_ending_alerts: 0,
    trial_expired_downgrades: 0,
    past_due_downgrades: 0,
    renewal_alerts: 0,
    errors: [] as string[],
  };

  try {
    // 1. Alerter les essais gratuits qui se terminent dans 3 jours
    const trialEndingSoon = addDays(today, 3);

    const { data: trialingSubs, error: trialError }: any = await supabase
      .from("subscriptions")
      .select(`
        id,
        owner_id,
        trial_end,
        plan:subscription_plans(name, slug),
        owner:profiles!subscriptions_owner_id_fkey(
          id, prenom, nom, user_id
        )
      `)
      .eq("status", "trialing")
      .lte("trial_end", trialEndingSoon.toISOString())
      .gte("trial_end", today.toISOString());

    if (trialError) {
      results.errors.push(`Erreur récupération essais: ${trialError.message}`);
    } else if (trialingSubs) {
      for (const sub of trialingSubs) {
        try {
          const trialEnd = new Date(sub.trial_end);
          const daysRemaining = differenceInDays(trialEnd, today);

          // Vérifier si déjà alerté
          const { data: existingAlert } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", sub.owner.user_id)
            .eq("type", "trial_ending_soon")
            .gte("created_at", addDays(today, -2).toISOString())
            .single();

          if (existingAlert) continue;

          await supabase.from("notifications").insert({
            user_id: sub.owner.user_id,
            type: "trial_ending_soon",
            title: "⏰ Votre essai se termine bientôt",
            message: `Votre essai gratuit du plan ${sub.plan.name} se termine dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}. Passez à la version payante pour continuer à profiter de toutes les fonctionnalités.`,
            data: {
              subscription_id: sub.id,
              plan_name: sub.plan.name,
              plan_slug: sub.plan.slug,
              trial_end: sub.trial_end,
              days_remaining: daysRemaining,
            },
          });

          // Email de rappel
          const { data: authUser } = await supabase.auth.admin.getUserById(sub.owner.user_id);
          if (authUser?.user?.email) {
            const emailData = emailTemplates.trialEndingSoon({
              userName: sub.owner.prenom || "Propriétaire",
              planName: sub.plan.name,
              daysRemaining,
              upgradeUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.talok.fr"}/pricing`,
            });
            try {
              await sendEmail({ to: authUser.user.email, ...emailData });
            } catch (emailError) {
              console.error("Erreur envoi email trial_ending:", emailError);
            }
          }

          results.trial_ending_alerts++;
          results.processed++;
        } catch (subError: any) {
          results.errors.push(`Subscription ${sub.id}: ${subError.message}`);
        }
      }
    }

    // 2. Alerter les abonnements qui vont se renouveler dans 7 jours
    const renewingSoon = addDays(today, 7);

    const { data: renewingSubs, error: renewError }: any = await supabase
      .from("subscriptions")
      .select(`
        id,
        owner_id,
        current_period_end,
        billing_cycle,
        cancel_at_period_end,
        plan:subscription_plans(name, slug, price_monthly, price_yearly),
        owner:profiles!subscriptions_owner_id_fkey(
          id, prenom, nom, user_id
        )
      `)
      .eq("status", "active")
      .eq("cancel_at_period_end", false)
      .lte("current_period_end", renewingSoon.toISOString())
      .gte("current_period_end", today.toISOString());

    if (renewError) {
      results.errors.push(`Erreur récupération renouvellements: ${renewError.message}`);
    } else if (renewingSubs) {
      for (const sub of renewingSubs) {
        try {
          const periodEnd = new Date(sub.current_period_end);
          const daysRemaining = differenceInDays(periodEnd, today);
          
          // Ne notifier qu'une fois (vérifier si notifié récemment)
          const { data: existingAlert } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", sub.owner.user_id)
            .eq("type", "subscription_renewing")
            .gte("created_at", addDays(today, -5).toISOString())
            .single();

          if (existingAlert) continue;

          const price = sub.billing_cycle === "yearly" 
            ? sub.plan.price_yearly 
            : sub.plan.price_monthly;
          const formattedPrice = (price / 100).toFixed(2);
          const formattedDate = format(periodEnd, "d MMMM yyyy", { locale: fr });

          await supabase.from("notifications").insert({
            user_id: sub.owner.user_id,
            type: "subscription_renewing",
            title: "🔄 Renouvellement à venir",
            message: `Votre abonnement ${sub.plan.name} sera renouvelé automatiquement le ${formattedDate} (${formattedPrice}€/${sub.billing_cycle === "yearly" ? "an" : "mois"}).`,
            data: {
              subscription_id: sub.id,
              plan_name: sub.plan.name,
              renewal_date: sub.current_period_end,
              amount: price,
              billing_cycle: sub.billing_cycle,
            },
          });

          results.renewal_alerts++;
          results.processed++;
        } catch (subError: any) {
          results.errors.push(`Subscription ${sub.id}: ${subError.message}`);
        }
      }
    }

    // 3. Alerter les abonnements annulés qui expirent bientôt
    const canceledExpiringSoon = addDays(today, 7);

    const { data: canceledSubs, error: cancelError }: any = await supabase
      .from("subscriptions")
      .select(`
        id,
        owner_id,
        current_period_end,
        plan:subscription_plans(name),
        owner:profiles!subscriptions_owner_id_fkey(
          id, prenom, nom, user_id
        )
      `)
      .eq("status", "active")
      .eq("cancel_at_period_end", true)
      .lte("current_period_end", canceledExpiringSoon.toISOString())
      .gte("current_period_end", today.toISOString());

    if (!cancelError && canceledSubs) {
      for (const sub of canceledSubs) {
        try {
          const periodEnd = new Date(sub.current_period_end);
          const daysRemaining = differenceInDays(periodEnd, today);

          // Vérifier si déjà alerté
          const { data: existingAlert } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", sub.owner.user_id)
            .eq("type", "subscription_ending")
            .gte("created_at", addDays(today, -3).toISOString())
            .single();

          if (existingAlert) continue;

          const formattedDate = format(periodEnd, "d MMMM yyyy", { locale: fr });

          await supabase.from("notifications").insert({
            user_id: sub.owner.user_id,
            type: "subscription_ending",
            title: "⚠️ Votre abonnement se termine",
            message: `Votre abonnement ${sub.plan.name} se termine le ${formattedDate}. Vous passerez au plan gratuit avec des fonctionnalités limitées.`,
            data: {
              subscription_id: sub.id,
              plan_name: sub.plan.name,
              end_date: sub.current_period_end,
              days_remaining: daysRemaining,
            },
          });

          results.processed++;
        } catch (subError: any) {
          results.errors.push(`Canceled sub ${sub.id}: ${subError.message}`);
        }
      }
    }

    // 4. Auto-downgrade : essais expirés → passer au plan gratuit
    const { data: expiredTrials, error: expTrialError }: any = await supabase
      .from("subscriptions")
      .select("id, owner_id, plan_slug, owner:profiles!subscriptions_owner_id_fkey(user_id)")
      .eq("status", "trialing")
      .lt("trial_end", today.toISOString());

    if (!expTrialError && expiredTrials) {
      // Récupérer l'ID du plan gratuit
      const { data: gratuitPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("slug", "gratuit")
        .single();

      for (const sub of expiredTrials) {
        try {
          const updateData: Record<string, any> = {
            status: "active",
            plan_slug: "gratuit",
            updated_at: new Date().toISOString(),
          };
          if (gratuitPlan) {
            updateData.plan_id = gratuitPlan.id;
          }

          await supabase
            .from("subscriptions")
            .update(updateData)
            .eq("id", sub.id);

          // Notification
          if (sub.owner?.user_id) {
            await supabase.from("notifications").insert({
              user_id: sub.owner.user_id,
              type: "trial_expired",
              title: "Essai terminé",
              message: "Votre période d'essai est terminée. Vous êtes passé au plan gratuit. Abonnez-vous pour continuer à profiter de toutes les fonctionnalités.",
              data: { subscription_id: sub.id, previous_plan: sub.plan_slug },
            });
          }

          results.trial_expired_downgrades++;
          results.processed++;
        } catch (subError: any) {
          results.errors.push(`Trial expired ${sub.id}: ${subError.message}`);
        }
      }
    }

    // 5. Grace period : past_due depuis +7 jours → downgrade vers gratuit
    const pastDueCutoff = addDays(today, -7);

    const { data: longPastDueSubs, error: pastDueError }: any = await supabase
      .from("subscriptions")
      .select("id, owner_id, plan_slug, updated_at, owner:profiles!subscriptions_owner_id_fkey(user_id)")
      .eq("status", "past_due")
      .lt("updated_at", pastDueCutoff.toISOString());

    if (!pastDueError && longPastDueSubs) {
      const { data: gratuitPlan } = await supabase
        .from("subscription_plans")
        .select("id")
        .eq("slug", "gratuit")
        .single();

      for (const sub of longPastDueSubs) {
        try {
          const updateData: Record<string, any> = {
            status: "canceled",
            plan_slug: "gratuit",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          if (gratuitPlan) {
            updateData.plan_id = gratuitPlan.id;
          }

          await supabase
            .from("subscriptions")
            .update(updateData)
            .eq("id", sub.id);

          // Notification
          if (sub.owner?.user_id) {
            await supabase.from("notifications").insert({
              user_id: sub.owner.user_id,
              type: "subscription_downgraded_payment",
              title: "Abonnement suspendu",
              message: "Votre abonnement a été suspendu suite à un échec de paiement prolongé. Mettez à jour vos informations de paiement pour réactiver.",
              data: { subscription_id: sub.id, previous_plan: sub.plan_slug },
            });
          }

          results.past_due_downgrades++;
          results.processed++;
        } catch (subError: any) {
          results.errors.push(`Past due downgrade ${sub.id}: ${subError.message}`);
        }
      }
    }

    // Log du résultat
    await supabase.from("audit_log").insert({
      action: "cron_subscription_alerts",
      entity_type: "cron",
      metadata: {
        ...results,
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.processed} alertes envoyées`,
      ...results,
    });
  } catch (error: unknown) {
    console.error("Erreur cron subscription-alerts:", error);

    await supabase.from("audit_log").insert({
      action: "cron_subscription_alerts_error",
      entity_type: "cron",
      metadata: {
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        ...results,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}


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
    trials_expired: 0,
    trial_ending_alerts: 0,
    renewal_alerts: 0,
    errors: [] as string[],
  };

  try {
    // Le statut Stripe fait autorité — ne jamais forcer expired côté code.
    // Stripe envoie un webhook customer.subscription.updated quand le trial se termine.
    // Ce cron ne gère que les ALERTES, pas les changements de statut.

    // 1. Alerter les essais gratuits qui se terminent dans 3 jours
    const trialEndingSoon = addDays(today, 3);

    const { data: trialingSubs, error: trialError }: any = await supabase
      .from("subscriptions")
      .select(`
        id,
        owner_id,
        trial_end,
        plan:subscription_plans!plan_id(name, slug),
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

          results.trial_ending_alerts++;
          results.processed++;

          // Notify admins
          import("@/lib/services/admin-notification.service").then(({ notifyAdmins }) =>
            notifyAdmins({
              type: "trial_expired",
              title: "Essai expirant",
              body: `Plan ${sub.plan.name} — expire dans ${daysRemaining}j`,
              actionUrl: "/admin/subscriptions",
              metadata: { subscription_id: sub.id, days_remaining: daysRemaining },
            })
          ).catch(() => {});
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
        plan:subscription_plans!plan_id(name, slug, price_monthly, price_yearly),
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
        plan:subscription_plans!plan_id(name),
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


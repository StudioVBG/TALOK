export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { assertCronAuth } from '@/lib/helpers/copro-cron-helpers';
import { sendEmail } from '@/lib/emails/resend.service';

const LOG_PREFIX = '[CRON copro-overdue-alerts]';

export async function GET(request: Request) {
  const authError = assertCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const stats = {
    sitesProcessed: 0,
    notificationsSent: 0,
    linesMarkedOverdue: 0,
    errors: 0,
  };

  try {
    console.log(LOG_PREFIX, 'Starting weekly overdue fund call alerts...');

    // 1. Find all sites with overdue fund call lines
    const { data: overdueLines, error: queryError } = await supabase
      .from('copro_fund_call_lines')
      .select(`
        id,
        call_id,
        lot_id,
        owner_name,
        amount_cents,
        paid_cents,
        payment_status,
        reminder_count,
        copro_fund_calls!inner (
          id,
          entity_id,
          due_date,
          period_label
        )
      `)
      .in('payment_status', ['pending', 'partial'])
      .lt('copro_fund_calls.due_date', new Date().toISOString()) as any;

    if (queryError) {
      console.error(LOG_PREFIX, 'Error querying overdue lines:', queryError);
      throw queryError;
    }

    if (!overdueLines || overdueLines.length === 0) {
      console.log(LOG_PREFIX, 'No overdue fund call lines found.');
      return NextResponse.json({
        success: true,
        stats,
        date: new Date().toISOString(),
      });
    }

    // We need to resolve site_id from copro_fund_calls.entity_id
    // entity_id on copro_fund_calls references the site
    // 2. Group by site (entity_id)
    const siteMap = new Map<
      string,
      {
        lines: any[];
        totalOverdueCents: number;
        maxDaysOverdue: number;
        overdueCount: number;
      }
    >();

    const now = new Date();

    for (const line of overdueLines as any[]) {
      const fundCall = line.copro_fund_calls as any;
      const siteId = fundCall.entity_id;
      const dueDate = new Date(fundCall.due_date);
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remainingCents = (line.amount_cents || 0) - (line.paid_cents || 0);

      if (!siteMap.has(siteId)) {
        siteMap.set(siteId, {
          lines: [],
          totalOverdueCents: 0,
          maxDaysOverdue: 0,
          overdueCount: 0,
        });
      }

      const entry = siteMap.get(siteId)!;
      entry.lines.push({ ...line, daysOverdue });
      entry.totalOverdueCents += remainingCents;
      entry.maxDaysOverdue = Math.max(entry.maxDaysOverdue, daysOverdue);
      entry.overdueCount += 1;
    }

    // 3. For each site, load syndic profile and send notification + email
    for (const [siteId, data] of siteMap.entries()) {
      try {
        // Load syndic profile
        const { data: site, error: siteError } = (await supabase
          .from('sites')
          .select('id, name, syndic_profile_id')
          .eq('id', siteId)
          .single()) as any;

        if (siteError || !site) {
          console.error(LOG_PREFIX, `Site not found: ${siteId}`, siteError);
          stats.errors++;
          continue;
        }

        const { data: profile, error: profileError } = (await supabase
          .from('profiles')
          .select('id, user_id, prenom, nom, email')
          .eq('id', site.syndic_profile_id)
          .single()) as any;

        if (profileError || !profile) {
          console.error(
            LOG_PREFIX,
            `Profile not found for syndic_profile_id: ${site.syndic_profile_id}`,
            profileError
          );
          stats.errors++;
          continue;
        }

        const totalEuros = (data.totalOverdueCents / 100).toFixed(2);
        const message = `Récapitulatif impayés : ${data.overdueCount} copropriétaire(s) en retard, total ${totalEuros} €, ancienneté max ${data.maxDaysOverdue} jours`;

        // 4. Insert in-app notification
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            profile_id: profile.id,
            user_id: profile.user_id,
            type: 'copro_overdue_alert',
            title: `Impayés copropriété — ${site.name}`,
            message,
            action_url: `/copro/sites/${siteId}/fund-calls`,
            is_read: false,
            priority: data.maxDaysOverdue > 90 ? 'high' : 'medium',
            status: 'sent',
            channels_status: { in_app: 'sent', email: 'pending' },
          });

        if (notifError) {
          console.error(LOG_PREFIX, 'Error inserting notification:', notifError);
          stats.errors++;
        }

        // Send email to syndic
        try {
          await sendEmail({
            to: profile.email,
            subject: `Récapitulatif impayés — ${site.name}`,
            html: `
              <h2>Récapitulatif des impayés</h2>
              <p>Bonjour ${profile.prenom || ''} ${profile.nom || ''},</p>
              <p>Voici le récapitulatif hebdomadaire des impayés pour la copropriété <strong>${site.name}</strong> :</p>
              <ul>
                <li><strong>${data.overdueCount}</strong> copropriétaire(s) en retard</li>
                <li>Montant total impayé : <strong>${totalEuros} €</strong></li>
                <li>Ancienneté maximale : <strong>${data.maxDaysOverdue} jours</strong></li>
              </ul>
              <p>Connectez-vous à Talok pour consulter le détail et relancer les copropriétaires concernés.</p>
            `,
          });
        } catch (emailErr) {
          console.error(LOG_PREFIX, 'Error sending email:', emailErr);
          stats.errors++;
        }

        stats.notificationsSent++;
        stats.sitesProcessed++;

        // 5. For lines overdue > 90 days, mark as 'overdue'
        const linesToMarkOverdue = data.lines.filter(
          (l: any) => l.daysOverdue > 90
        );

        for (const line of linesToMarkOverdue) {
          const { error: updateError } = await supabase
            .from('copro_fund_call_lines')
            .update({ payment_status: 'overdue' })
            .eq('id', line.id);

          if (updateError) {
            console.error(
              LOG_PREFIX,
              `Error marking line ${line.id} as overdue:`,
              updateError
            );
            stats.errors++;
          } else {
            stats.linesMarkedOverdue++;
          }
        }
      } catch (siteErr) {
        console.error(
          LOG_PREFIX,
          `Error processing site ${siteId}:`,
          siteErr
        );
        stats.errors++;
      }
    }

    // 6. Log stats
    console.log(LOG_PREFIX, 'Completed. Stats:', stats);

    return NextResponse.json({
      success: true,
      stats,
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error(LOG_PREFIX, 'Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
        date: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

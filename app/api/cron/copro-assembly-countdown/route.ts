export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import {
  assertCronAuth,
  findCoproprietairesForSite,
} from '@/lib/helpers/copro-cron-helpers';
import { sendEmail } from '@/lib/emails/resend.service';

const LOG_PREFIX = '[CRON copro-assembly-countdown]';

export async function GET(request: Request) {
  const authError = assertCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const stats = {
    finalReminders: 0,
    unsignedPvAlerts: 0,
    undistributedPvAlerts: 0,
    errors: 0,
  };

  try {
    console.log(LOG_PREFIX, 'Starting daily assembly countdown checks...');

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // ─────────────────────────────────────────────
    // 1. Assemblies within 48h → final reminder to copropriétaires
    // ─────────────────────────────────────────────
    const { data: upcomingAssemblies, error: upcomingError } = (await supabase
      .from('copro_assemblies')
      .select('id, site_id, title, scheduled_at, assembly_type, reference_number')
      .in('status', ['convened', 'in_progress'])
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', in48h.toISOString())) as any;

    if (upcomingError) {
      console.error(LOG_PREFIX, 'Error querying upcoming assemblies:', upcomingError);
      stats.errors++;
    } else if (upcomingAssemblies && upcomingAssemblies.length > 0) {
      console.log(
        LOG_PREFIX,
        `Found ${upcomingAssemblies.length} assemblies within 48h`
      );

      for (const assembly of upcomingAssemblies as any[]) {
        try {
          const coproprietaires = await findCoproprietairesForSite(
            supabase,
            assembly.site_id
          );

          if (!coproprietaires || coproprietaires.length === 0) {
            console.log(
              LOG_PREFIX,
              `No copropriétaires found for site ${assembly.site_id}`
            );
            continue;
          }

          const scheduledDate = new Date(assembly.scheduled_at);
          const formattedDate = scheduledDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          for (const copro of coproprietaires as any[]) {
            try {
              // Insert in-app notification
              await supabase.from('notifications').insert({
                profile_id: copro.profile_id || copro.id,
                user_id: copro.user_id,
                type: 'copro_assembly_reminder',
                title: `Rappel AG — ${assembly.title || 'Assemblée Générale'}`,
                message: `Votre assemblée générale "${assembly.title || 'AG'}" est prévue le ${formattedDate}. Pensez à préparer vos documents et pouvoirs.`,
                action_url: `/copro/assemblies/${assembly.id}`,
                is_read: false,
                priority: 'high',
                status: 'sent',
                channels_status: { in_app: 'sent', email: 'pending' },
              });

              // Send email
              if (copro.email) {
                await sendEmail({
                  to: copro.email,
                  subject: `Rappel : Assemblée Générale le ${formattedDate}`,
                  html: `
                    <h2>Rappel — Assemblée Générale</h2>
                    <p>Bonjour ${copro.prenom || ''} ${copro.nom || ''},</p>
                    <p>Nous vous rappelons que l'assemblée générale <strong>"${assembly.title || 'AG'}"</strong> se tiendra le :</p>
                    <p style="font-size: 1.2em; font-weight: bold; color: #2563eb;">${formattedDate}</p>
                    <p>Pensez à préparer vos documents et, le cas échéant, vos pouvoirs de représentation.</p>
                    <p>Référence : ${assembly.reference_number || 'N/A'}</p>
                  `,
                });
              }

              stats.finalReminders++;
            } catch (coproErr) {
              console.error(
                LOG_PREFIX,
                `Error notifying copropriétaire ${copro.id}:`,
                coproErr
              );
              stats.errors++;
            }
          }
        } catch (assemblyErr) {
          console.error(
            LOG_PREFIX,
            `Error processing assembly ${assembly.id}:`,
            assemblyErr
          );
          stats.errors++;
        }
      }
    }

    // ─────────────────────────────────────────────
    // 2. Assemblies held > 30 days ago with unsigned PV
    // ─────────────────────────────────────────────
    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: heldAssemblies30, error: held30Error } = (await supabase
      .from('copro_assemblies')
      .select('id, site_id, title, held_at')
      .eq('status', 'held')
      .lt('held_at', thirtyDaysAgo)) as any;

    if (held30Error) {
      console.error(LOG_PREFIX, 'Error querying held assemblies (30d):', held30Error);
      stats.errors++;
    } else if (heldAssemblies30 && heldAssemblies30.length > 0) {
      for (const assembly of heldAssemblies30 as any[]) {
        try {
          // Check if a signed minute exists
          const { data: signedMinutes, error: minuteError } = (await supabase
            .from('copro_minutes')
            .select('id, signed_by_president_at')
            .eq('assembly_id', assembly.id)
            .not('signed_by_president_at', 'is', null)) as any;

          if (minuteError) {
            console.error(LOG_PREFIX, 'Error checking minutes:', minuteError);
            stats.errors++;
            continue;
          }

          // If no signed minute found → alert syndic
          if (!signedMinutes || signedMinutes.length === 0) {
            const { data: site } = (await supabase
              .from('sites')
              .select('id, name, syndic_profile_id')
              .eq('id', assembly.site_id)
              .single()) as any;

            if (!site) continue;

            const { data: profile } = (await supabase
              .from('profiles')
              .select('id, user_id, prenom, nom, email')
              .eq('id', site.syndic_profile_id)
              .single()) as any;

            if (!profile) continue;

            const heldDate = new Date(assembly.held_at).toLocaleDateString(
              'fr-FR'
            );
            const message = `PV non signé depuis 30 jours pour l'AG du ${heldDate}`;

            await supabase.from('notifications').insert({
              profile_id: profile.id,
              user_id: profile.user_id,
              type: 'copro_pv_unsigned_alert',
              title: `PV non signé — ${assembly.title || 'AG'}`,
              message,
              action_url: `/copro/assemblies/${assembly.id}/minutes`,
              is_read: false,
              priority: 'high',
              status: 'sent',
              channels_status: { in_app: 'sent', email: 'pending' },
            });

            if (profile.email) {
              await sendEmail({
                to: profile.email,
                subject: `Alerte : PV non signé — ${assembly.title || 'AG'}`,
                html: `
                  <h2>PV non signé</h2>
                  <p>Bonjour ${profile.prenom || ''} ${profile.nom || ''},</p>
                  <p>${message} pour la copropriété <strong>${site.name}</strong>.</p>
                  <p>Merci de procéder à la signature du procès-verbal dans les meilleurs délais.</p>
                `,
              });
            }

            stats.unsignedPvAlerts++;
          }
        } catch (err) {
          console.error(
            LOG_PREFIX,
            `Error checking unsigned PV for assembly ${assembly.id}:`,
            err
          );
          stats.errors++;
        }
      }
    }

    // ─────────────────────────────────────────────
    // 3. Assemblies held > 60 days ago with undistributed PV
    // ─────────────────────────────────────────────
    const sixtyDaysAgo = new Date(
      now.getTime() - 60 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: heldAssemblies60, error: held60Error } = (await supabase
      .from('copro_assemblies')
      .select('id, site_id, title, held_at')
      .eq('status', 'held')
      .lt('held_at', sixtyDaysAgo)) as any;

    if (held60Error) {
      console.error(LOG_PREFIX, 'Error querying held assemblies (60d):', held60Error);
      stats.errors++;
    } else if (heldAssemblies60 && heldAssemblies60.length > 0) {
      for (const assembly of heldAssemblies60 as any[]) {
        try {
          // Check if a distributed minute exists
          const { data: distributedMinutes, error: minuteError } = (await supabase
            .from('copro_minutes')
            .select('id, status')
            .eq('assembly_id', assembly.id)
            .eq('status', 'distributed')) as any;

          if (minuteError) {
            console.error(LOG_PREFIX, 'Error checking distributed minutes:', minuteError);
            stats.errors++;
            continue;
          }

          // If no distributed minute found → alert syndic (legal obligation)
          if (!distributedMinutes || distributedMinutes.length === 0) {
            const { data: site } = (await supabase
              .from('sites')
              .select('id, name, syndic_profile_id')
              .eq('id', assembly.site_id)
              .single()) as any;

            if (!site) continue;

            const { data: profile } = (await supabase
              .from('profiles')
              .select('id, user_id, prenom, nom, email')
              .eq('id', site.syndic_profile_id)
              .single()) as any;

            if (!profile) continue;

            const message = `PV non distribué depuis 60 jours (obligation légale)`;

            await supabase.from('notifications').insert({
              profile_id: profile.id,
              user_id: profile.user_id,
              type: 'copro_pv_undistributed_alert',
              title: `PV non distribué — ${assembly.title || 'AG'}`,
              message,
              action_url: `/copro/assemblies/${assembly.id}/minutes`,
              is_read: false,
              priority: 'critical',
              status: 'sent',
              channels_status: { in_app: 'sent', email: 'pending' },
            });

            if (profile.email) {
              const heldDate = new Date(assembly.held_at).toLocaleDateString(
                'fr-FR'
              );
              await sendEmail({
                to: profile.email,
                subject: `⚠ Obligation légale : PV non distribué — ${assembly.title || 'AG'}`,
                html: `
                  <h2>PV non distribué — Obligation légale</h2>
                  <p>Bonjour ${profile.prenom || ''} ${profile.nom || ''},</p>
                  <p>Le procès-verbal de l'assemblée générale <strong>"${assembly.title || 'AG'}"</strong> du ${heldDate} pour la copropriété <strong>${site.name}</strong> n'a toujours pas été distribué.</p>
                  <p><strong>Rappel :</strong> La distribution du PV est une obligation légale et doit être effectuée dans les délais impartis.</p>
                  <p>Merci de procéder à la distribution dans les meilleurs délais.</p>
                `,
              });
            }

            stats.undistributedPvAlerts++;
          }
        } catch (err) {
          console.error(
            LOG_PREFIX,
            `Error checking undistributed PV for assembly ${assembly.id}:`,
            err
          );
          stats.errors++;
        }
      }
    }

    // 4. Log stats
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

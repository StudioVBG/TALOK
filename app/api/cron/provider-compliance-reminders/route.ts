export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET ou POST /api/cron/provider-compliance-reminders
 *
 * Cron quotidien (9h) : envoie aux prestataires des rappels d'expiration
 * de leurs documents compliance (RC Pro, decennale, Kbis, urssaf, etc.).
 *
 * Fenetres :
 *   - J-30 : un mois avant expiration
 *   - J-7  : une semaine avant expiration
 *   - J0/J+1 : le jour de l'expiration et le lendemain (statut "expire")
 *
 * Idempotent grace a la cle Resend `compliance-reminder/<provider>/<label>/<window>`
 * qui dedupplique a +/- 24h pres.
 *
 * Auth : Bearer <CRON_SECRET> en production.
 */

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sendProviderComplianceReminderEmail } from '@/lib/emails/resend.service';

const DOCUMENT_LABELS: Record<string, string> = {
  rc_pro: 'Responsabilité Civile Professionnelle',
  decennale: 'Assurance décennale',
  kbis: 'Extrait Kbis',
  id_card_recto: "Pièce d'identité",
  id_card_verso: "Pièce d'identité",
  rib: 'RIB / IBAN',
  urssaf: 'Attestation URSSAF',
  qualification: 'Qualification professionnelle',
  insurance_other: 'Assurance professionnelle',
  other: 'Document de conformité',
};

type Window = 'expired' | 'j7' | 'j30';

function dayDiff(target: Date, now: Date): number {
  const ms = target.getTime() - now.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function pickWindow(daysUntil: number): Window | null {
  if (daysUntil <= 1 && daysUntil >= -7) return 'expired';
  if (daysUntil <= 7 && daysUntil > 1) return 'j7';
  if (daysUntil <= 30 && daysUntil > 7) return 'j30';
  return null;
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}

async function run(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
      }
    }

    const serviceClient = getServiceClient();
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 31); // borne sup recherche
    const lower = new Date(now);
    lower.setDate(lower.getDate() - 8); // capture les expires recents

    const { data: docs, error } = await serviceClient
      .from('provider_compliance_documents')
      .select('id, provider_profile_id, document_type, expiration_date, verification_status')
      .gte('expiration_date', lower.toISOString().slice(0, 10))
      .lte('expiration_date', horizon.toISOString().slice(0, 10))
      .in('verification_status', ['verified', 'pending']);

    if (error) {
      console.error('[provider-compliance-reminders] query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (docs || []) as Array<{
      id: string;
      provider_profile_id: string;
      document_type: string;
      expiration_date: string;
      verification_status: string;
    }>;

    if (rows.length === 0) {
      return NextResponse.json({ success: true, processed: 0, total: 0 });
    }

    const providerIds = Array.from(new Set(rows.map((r) => r.provider_profile_id)));
    const { data: providers } = await serviceClient
      .from('profiles')
      .select('id, prenom, nom, email')
      .in('id', providerIds);

    const providerById = new Map<string, { prenom?: string | null; nom?: string | null; email?: string | null }>();
    for (const p of providers || []) {
      providerById.set(p.id, { prenom: p.prenom, nom: p.nom, email: p.email });
    }

    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOutOfWindow = 0;
    const errors: Array<{ doc_id: string; reason: string }> = [];

    for (const doc of rows) {
      const expiry = new Date(doc.expiration_date);
      if (isNaN(expiry.getTime())) {
        errors.push({ doc_id: doc.id, reason: 'invalid expiration_date' });
        continue;
      }

      const daysUntil = dayDiff(expiry, now);
      const window = pickWindow(daysUntil);
      if (!window) {
        skippedOutOfWindow++;
        continue;
      }

      const provider = providerById.get(doc.provider_profile_id);
      if (!provider?.email) {
        skippedNoEmail++;
        continue;
      }

      const label = DOCUMENT_LABELS[doc.document_type] || 'Document de conformité';
      const recipientName =
        `${provider.prenom || ''} ${provider.nom || ''}`.trim() || 'Prestataire';

      try {
        await sendProviderComplianceReminderEmail({
          providerEmail: provider.email,
          providerProfileId: doc.provider_profile_id,
          recipientName,
          documentLabel: label,
          expirationDate: doc.expiration_date,
          daysUntilExpiration: daysUntil,
          window,
        });
        sent++;
      } catch (err) {
        errors.push({
          doc_id: doc.id,
          reason: err instanceof Error ? err.message : 'send error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      sent,
      skipped: skippedNoEmail + skippedOutOfWindow,
      errors,
    });
  } catch (err) {
    console.error('[provider-compliance-reminders] fatal:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}

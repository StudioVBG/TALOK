export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * POST /api/v1/applications/[id]/score — Lancer le scoring IA (Pro+ uniquement)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Récupérer la candidature
    const { data: application } = await serviceClient
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (!application) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }

    const appData = application as any;

    if (appData.owner_id !== (profile as any)?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Vérifier le plan (Pro+ requis)
    const { data: subscription } = await serviceClient
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const plan = (subscription as any)?.plan || 'gratuit';
    if (plan === 'gratuit' || plan === 'confort') {
      return NextResponse.json(
        { error: 'Le scoring IA est réservé au plan Pro et supérieur' },
        { status: 403 }
      );
    }

    // Mettre à jour le statut
    await serviceClient
      .from('applications')
      .update({ status: 'scoring' } as any)
      .eq('id', id);

    // Calculer le score basé sur les données disponibles
    const { calculateSolvabilityScore } = await import('@/lib/scoring/calculate-score');

    const docs = (appData.documents || []) as any[];
    const hasIdentity = docs.some((d: any) => d.type === 'identity');
    const hasIncome = docs.some((d: any) => d.type === 'income');
    const hasTaxNotice = docs.some((d: any) => d.type === 'tax_notice');
    const hasEmployment = docs.some((d: any) => d.type === 'employment');
    const hasRentReceipts = docs.some((d: any) => d.type === 'rent_receipt');

    // Récupérer les infos du listing pour le calcul
    const { data: listing } = await serviceClient
      .from('property_listings')
      .select('rent_amount_cents, charges_cents')
      .eq('id', appData.listing_id)
      .single();

    const listingInfo = listing as any;
    const rentAmount = (listingInfo?.rent_amount_cents || 0) / 100;
    const chargesAmount = (listingInfo?.charges_cents || 0) / 100;

    // Score simplifié basé sur la complétude du dossier
    const scoreResult = calculateSolvabilityScore({
      monthlyIncome: 2500, // Valeur par défaut — sera raffinée par l'OCR
      rentAmount,
      chargesAmount,
      employmentType: hasEmployment ? 'cdi' : 'autre',
      hasGuarantor: false,
      documentsProvided: {
        idCard: hasIdentity,
        proofOfIncome: hasIncome,
        taxNotice: hasTaxNotice,
        employmentContract: hasEmployment,
        previousRentReceipts: hasRentReceipts,
        bankStatements: false,
      },
      previousRentHistory: 'unknown',
      hasUnpaidRentHistory: false,
    });

    // Sauvegarder le score
    const { data: updated, error: updateError } = await serviceClient
      .from('applications')
      .update({
        ai_score: scoreResult.totalScore,
        status: 'complete',
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      application: updated,
      scoring: {
        total_score: scoreResult.totalScore,
        recommendation: scoreResult.recommendation,
        risk_level: scoreResult.riskLevel,
        factors: scoreResult.factors,
        strengths: scoreResult.strengths,
        risks: scoreResult.risks,
      },
    });
  } catch (error: unknown) {
    console.error('[POST /api/v1/applications/[id]/score] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

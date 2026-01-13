/**
 * Revenue Intelligence API
 * SOTA 2026 - Real-time revenue analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateRevenueMetrics,
  generateCohortAnalysis,
  generateRevenueForecast,
  generateMRRWaterfall,
  getSubscriptionAnalytics,
} from '@/lib/payments/sota-2026';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'metrics';

    switch (type) {
      case 'metrics': {
        const metrics = await calculateRevenueMetrics();
        return NextResponse.json(metrics);
      }

      case 'cohorts': {
        const months = parseInt(searchParams.get('months') || '12');
        const cohorts = await generateCohortAnalysis(months);
        return NextResponse.json(cohorts);
      }

      case 'forecast': {
        const months = parseInt(searchParams.get('months') || '12');
        const forecast = await generateRevenueForecast(months);
        return NextResponse.json(forecast);
      }

      case 'waterfall': {
        const months = parseInt(searchParams.get('months') || '6');
        const waterfall = await generateMRRWaterfall(months);
        return NextResponse.json(waterfall);
      }

      case 'analytics': {
        const analytics = await getSubscriptionAnalytics();
        return NextResponse.json(analytics);
      }

      default:
        return NextResponse.json(
          { error: 'Type invalide' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Revenue error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

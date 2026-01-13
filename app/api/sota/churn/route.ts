/**
 * Churn Prediction API
 * SOTA 2026 - AI-powered churn risk analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateChurnRisk,
  getHighRiskAccounts,
} from '@/lib/payments/sota-2026';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'self';

    // Check admin for high-risk list
    if (type === 'high-risk') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
      }

      const limit = parseInt(searchParams.get('limit') || '50');
      const accounts = await getHighRiskAccounts(limit);
      return NextResponse.json(accounts);
    }

    // Get own churn risk
    const prediction = await calculateChurnRisk(user.id);
    return NextResponse.json(prediction);
  } catch (error) {
    console.error('[API] Churn error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

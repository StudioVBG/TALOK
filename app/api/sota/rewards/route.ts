/**
 * Tenant Rewards API
 * SOTA 2026 - Loyalty program for rent payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRewardsAccount,
  getTransactionHistory,
  getRewardPartners,
  redeemPoints,
  getRedemptionHistory,
  getLeaderboard,
  getTenantRank,
  getTenantBadges,
  checkCreditReportingEligibility,
  enrollInCreditReporting,
  REWARDS_CONFIG,
} from '@/lib/payments/sota-2026';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'account';

    switch (type) {
      case 'account': {
        const account = await getRewardsAccount(user.id);
        const rank = await getTenantRank(user.id);
        const badges = await getTenantBadges(user.id);

        return NextResponse.json({
          ...account,
          rank,
          badges,
          config: {
            pointsPerEuro: REWARDS_CONFIG.pointsPerEuro,
            pointsPerEuroRedemption: REWARDS_CONFIG.pointsPerEuroRedemption,
            tiers: REWARDS_CONFIG.tiers,
          },
        });
      }

      case 'history': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const history = await getTransactionHistory(user.id, limit);
        return NextResponse.json(history);
      }

      case 'partners': {
        const category = searchParams.get('category') || undefined;
        const partners = await getRewardPartners(category);
        return NextResponse.json(partners);
      }

      case 'redemptions': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const redemptions = await getRedemptionHistory(user.id, limit);
        return NextResponse.json(redemptions);
      }

      case 'leaderboard': {
        const limit = parseInt(searchParams.get('limit') || '10');
        const leaderboard = await getLeaderboard(limit);
        return NextResponse.json(leaderboard);
      }

      case 'credit-eligibility': {
        const eligibility = await checkCreditReportingEligibility(user.id);
        return NextResponse.json(eligibility);
      }

      default:
        return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Rewards GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'redeem': {
        const { partnerId, points } = body;
        if (!partnerId || !points) {
          return NextResponse.json(
            { error: 'Partner ID et points requis' },
            { status: 400 }
          );
        }

        try {
          const redemption = await redeemPoints(user.id, partnerId, points);
          return NextResponse.json(redemption);
        } catch (redeemError: any) {
          return NextResponse.json(
            { error: redeemError.message },
            { status: 400 }
          );
        }
      }

      case 'enroll-credit-reporting': {
        const result = await enrollInCreditReporting(user.id);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Rewards POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

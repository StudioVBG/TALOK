/**
 * Embedded Finance API
 * SOTA 2026 - BNPL, Financing, Instant Payouts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  checkRentAdvanceEligibility,
  checkDepositSplitEligibility,
  checkBNPLEligibility,
  checkInstantPayoutEligibility,
  getFinancingOffers,
  applyForFinancing,
  requestInstantPayout,
  getPayoutHistory,
  createDepositSplit,
  createRentBNPL,
  calculateTotalCost,
  FINANCING_CONFIG,
} from '@/lib/payments/sota-2026';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'offers';

    switch (type) {
      case 'offers': {
        const offers = await getFinancingOffers(user.id);
        return NextResponse.json(offers);
      }

      case 'eligibility': {
        const offerType = searchParams.get('offer_type');

        switch (offerType) {
          case 'rent_advance': {
            const eligibility = await checkRentAdvanceEligibility(user.id);
            return NextResponse.json(eligibility);
          }
          case 'deposit_split': {
            const amount = parseFloat(searchParams.get('amount') || '0');
            const eligibility = await checkDepositSplitEligibility(user.id, amount);
            return NextResponse.json(eligibility);
          }
          case 'bnpl': {
            const eligibility = await checkBNPLEligibility(user.id);
            return NextResponse.json(eligibility);
          }
          case 'instant_payout': {
            const eligibility = await checkInstantPayoutEligibility(user.id);
            return NextResponse.json(eligibility);
          }
          default:
            // Return all eligibilities
            const [rentAdvance, bnpl, payout] = await Promise.all([
              checkRentAdvanceEligibility(user.id),
              checkBNPLEligibility(user.id),
              checkInstantPayoutEligibility(user.id),
            ]);

            return NextResponse.json({
              rent_advance: rentAdvance,
              bnpl: bnpl,
              instant_payout: payout,
            });
        }
      }

      case 'payouts': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const payouts = await getPayoutHistory(user.id, limit);
        return NextResponse.json(payouts);
      }

      case 'calculate': {
        const principal = parseFloat(searchParams.get('principal') || '0');
        const apr = parseFloat(searchParams.get('apr') || '0');
        const months = parseInt(searchParams.get('months') || '12');

        const calculation = calculateTotalCost(principal, apr, months);
        return NextResponse.json(calculation);
      }

      case 'config': {
        return NextResponse.json(FINANCING_CONFIG);
      }

      default:
        return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Finance GET error:', error);
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
      case 'apply': {
        const { offerId, amount } = body;
        if (!offerId || !amount) {
          return NextResponse.json(
            { error: 'Offer ID et montant requis' },
            { status: 400 }
          );
        }

        try {
          const application = await applyForFinancing(offerId, user.id, amount);
          return NextResponse.json(application);
        } catch (applyError: any) {
          return NextResponse.json(
            { error: applyError.message },
            { status: 400 }
          );
        }
      }

      case 'instant-payout': {
        const { amount, destination } = body;
        if (!amount || !destination) {
          return NextResponse.json(
            { error: 'Montant et destination requis' },
            { status: 400 }
          );
        }

        if (!['bank_account', 'debit_card'].includes(destination)) {
          return NextResponse.json(
            { error: 'Destination invalide' },
            { status: 400 }
          );
        }

        try {
          const payout = await requestInstantPayout(user.id, amount, destination);
          return NextResponse.json(payout);
        } catch (payoutError: any) {
          return NextResponse.json(
            { error: payoutError.message },
            { status: 400 }
          );
        }
      }

      case 'deposit-split': {
        const { leaseId, depositAmount } = body;
        if (!leaseId || !depositAmount) {
          return NextResponse.json(
            { error: 'Lease ID et montant requis' },
            { status: 400 }
          );
        }

        const result = await createDepositSplit(user.id, leaseId, depositAmount);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json(result);
      }

      case 'rent-bnpl': {
        const { invoiceId, rentAmount } = body;
        if (!invoiceId || !rentAmount) {
          return NextResponse.json(
            { error: 'Invoice ID et montant requis' },
            { status: 400 }
          );
        }

        const result = await createRentBNPL(user.id, invoiceId, rentAmount);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Finance POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

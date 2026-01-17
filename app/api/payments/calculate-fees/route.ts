export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route pour calculer les frais de paiement
 * GET /api/payments/calculate-fees?amount=1000
 * 
 * Retourne les frais Stripe + plateforme pour un montant donné
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculatePaymentFees, calculateDepositAndBalance, DEFAULT_FEE_CONFIG } from '@/lib/types/intervention-flow';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const amountStr = searchParams.get('amount');
    const includeDepositStr = searchParams.get('include_deposit');

    if (!amountStr) {
      return NextResponse.json(
        { error: 'Le paramètre "amount" est requis' },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Le montant doit être un nombre positif' },
        { status: 400 }
      );
    }

    // Calculer les frais simples
    const fees = calculatePaymentFees(amount);

    // Inclure le calcul acompte/solde si demandé
    const includeDeposit = includeDepositStr === 'true';
    const depositBreakdown = includeDeposit 
      ? calculateDepositAndBalance(amount) 
      : null;

    return NextResponse.json({
      amount,
      fees: {
        gross_amount: fees.gross_amount,
        stripe_fee: fees.stripe_fee,
        platform_fee: fees.platform_fee,
        total_fees: fees.total_fees,
        net_amount: fees.net_amount,
        effective_rate: `${fees.effective_rate}%`,
      },
      config: {
        stripe_percent: `${DEFAULT_FEE_CONFIG.stripe_percent * 100}%`,
        stripe_fixed: `${DEFAULT_FEE_CONFIG.stripe_fixed}€`,
        platform_percent: `${DEFAULT_FEE_CONFIG.platform_percent * 100}%`,
        platform_fixed: `${DEFAULT_FEE_CONFIG.platform_fixed}€`,
        fee_payer: DEFAULT_FEE_CONFIG.fee_payer,
      },
      ...(depositBreakdown && {
        deposit_breakdown: {
          deposit: {
            percent: `${depositBreakdown.deposit_percent}%`,
            amount: depositBreakdown.deposit_amount,
            fees: depositBreakdown.deposit_fees,
            net: depositBreakdown.deposit_net,
          },
          balance: {
            percent: `${depositBreakdown.balance_percent}%`,
            amount: depositBreakdown.balance_amount,
            fees: depositBreakdown.balance_fees,
            net: depositBreakdown.balance_net,
          },
          totals: {
            fees: depositBreakdown.total_fees,
            net: depositBreakdown.total_net,
          },
        },
      }),
    });
  } catch (error: unknown) {
    console.error('Error calculating fees:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' },
      { status: 500 }
    );
  }
}


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route pour calculer les frais de paiement
 * GET /api/payments/calculate-fees?amount=1000
 *
 * Retourne les frais Stripe + plateforme pour un montant donné
 * @version 2026-01-22 - Added Zod validation for query params
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculatePaymentFees, calculateDepositAndBalance, DEFAULT_FEE_CONFIG } from '@/lib/types/intervention-flow';
import { z } from 'zod';

/**
 * Zod schema for query parameters validation
 */
const querySchema = z.object({
  amount: z.coerce.number().positive("Le montant doit être positif").max(1000000, "Montant trop élevé"),
  include_deposit: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    // Validate query parameters with Zod
    const parseResult = querySchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, include_deposit: includeDeposit } = parseResult.data;

    // Calculer les frais simples
    const fees = calculatePaymentFees(amount);

    // Inclure le calcul acompte/solde si demandé
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


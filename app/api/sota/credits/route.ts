/**
 * Credits API
 * SOTA 2026 - Hybrid credit system
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCreditBalance,
  getCreditHistory,
  getCreditPackages,
  purchaseCreditPackage,
  spendCredits,
} from '@/lib/payments/sota-2026';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'balance';

    switch (type) {
      case 'balance': {
        const balance = await getCreditBalance(user.id);
        return NextResponse.json(balance);
      }

      case 'history': {
        const limit = parseInt(searchParams.get('limit') || '50');
        const history = await getCreditHistory(user.id, limit);
        return NextResponse.json(history);
      }

      case 'packages': {
        const packages = await getCreditPackages();
        return NextResponse.json(packages);
      }

      default:
        return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Credits GET error:', error);
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
      case 'purchase': {
        const { packageId } = body;
        if (!packageId) {
          return NextResponse.json({ error: 'Package ID requis' }, { status: 400 });
        }

        const result = await purchaseCreditPackage(user.id, packageId);
        return NextResponse.json(result);
      }

      case 'spend': {
        const { amount, description, referenceType, referenceId } = body;
        if (!amount || !description) {
          return NextResponse.json(
            { error: 'Montant et description requis' },
            { status: 400 }
          );
        }

        const result = await spendCredits(
          user.id,
          amount,
          description,
          referenceType,
          referenceId
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.transaction);
      }

      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API] Credits POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

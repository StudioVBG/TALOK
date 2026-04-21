export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { handleApiError, ApiError, validateWithZod } from '@/lib/helpers/api-error';
import { markAsPaid } from '@/features/providers/services/work-orders-extended.service';
import { markPaidSchema } from '@/lib/validations/providers';
import { injectChargeEntryForWorkOrder } from '@/lib/tickets/inject-charge-entry';

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, 'Non authentifie');

    const body = await request.json();
    const input = validateWithZod(markPaidSchema, body);
    const result = await markAsPaid(supabase, id, input);

    // Fire-and-forget : si l'intervention est récupérable auprès du locataire,
    // on injecte automatiquement la dépense dans charge_entries. Le helper est
    // idempotent (unique index sur source_work_order_id) et tolérant aux cas
    // non-chargeable / category manquante / pas encore payé — aucun effet de
    // bord si une condition manque. Service client pour bypass RLS sur
    // charge_entries.
    void (async () => {
      try {
        await injectChargeEntryForWorkOrder(getServiceClient(), id);
      } catch (err) {
        console.error('[work-orders/pay] auto-inject charge failed:', err);
      }
    })();

    return NextResponse.json({ success: true, workOrder: result });
  } catch (error) {
    return handleApiError(error);
  }
}

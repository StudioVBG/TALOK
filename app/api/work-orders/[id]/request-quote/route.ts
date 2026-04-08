export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleApiError, ApiError } from '@/lib/helpers/api-error';
import { requestQuote } from '@/features/providers/services/work-orders-extended.service';

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, 'Non authentifie');

    const body = await request.json().catch(() => ({}));
    const result = await requestQuote(supabase, id, body.provider_id);

    return NextResponse.json({ success: true, workOrder: result });
  } catch (error) {
    return handleApiError(error);
  }
}

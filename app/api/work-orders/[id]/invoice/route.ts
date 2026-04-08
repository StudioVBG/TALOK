export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleApiError, ApiError, validateWithZod } from '@/lib/helpers/api-error';
import { submitInvoice } from '@/features/providers/services/work-orders-extended.service';
import { submitInvoiceSchema } from '@/lib/validations/providers';

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, 'Non authentifie');

    const body = await request.json();
    const input = validateWithZod(submitInvoiceSchema, body);
    const result = await submitInvoice(supabase, id, input);

    return NextResponse.json({ success: true, workOrder: result });
  } catch (error) {
    return handleApiError(error);
  }
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleApiError, ApiError, validateWithZod } from '@/lib/helpers/api-error';
import { getProviderReviews } from '@/features/providers/services/providers.service';
import { createReview } from '@/features/providers/services/work-orders-extended.service';
import { createReviewSchema } from '@/lib/validations/providers';

interface RouteParams { params: Promise<{ id: string }> }

/** GET /api/providers/[id]/reviews — List reviews for a provider */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, 'Non authentifie');

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await getProviderReviews(supabase, id, { limit, offset });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/providers/[id]/reviews — Create a review after intervention */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, 'Non authentifie');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      throw new ApiError(403, 'Seuls les proprietaires peuvent laisser un avis');
    }

    const body = await request.json();
    const input = validateWithZod(createReviewSchema, {
      ...body,
      provider_profile_id: id,
    });

    const review = await createReview(supabase, profile.id, input);
    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

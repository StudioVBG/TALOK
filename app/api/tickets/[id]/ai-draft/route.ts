export const runtime = 'nodejs';

// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { messagingAiService } from "@/features/tickets/services/messaging-ai.service";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { withApiSecurity, securityPresets } from "@/lib/middleware/api-security";

export const POST = withApiSecurity(async (
  request: NextRequest,
  context?: { params?: { id: string } }
) => {
  const params = context?.params || { id: '' };
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const draft = await messagingAiService.suggestTicketReply(params.id, user.id);

    return NextResponse.json({ draft });
  } catch (error: any) {
    console.error("[API] Draft generation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}, securityPresets.authenticated);


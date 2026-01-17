export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { messagingAiService } from "@/features/tickets/services/messaging-ai.service";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const draft = await messagingAiService.suggestTicketReply(params.id, user.id);
    
    return NextResponse.json({ draft });
  } catch (error: unknown) {
    console.error("[API] Draft generation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}


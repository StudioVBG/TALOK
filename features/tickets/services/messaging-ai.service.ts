import { messageDraftGraph, MessageDraftState } from "./message-draft.graph";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export class MessagingAiService {
  
  /**
   * Suggest a reply based on ticket history
   */
  async suggestTicketReply(ticketId: string, userId: string) {
    const supabase = createClient(cookies());

    // 1. Fetch Ticket & Messages
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, tickets_messages(*)")
      .eq("id", ticketId)
      .single();

    if (!ticket) throw new Error("Ticket not found");

    // 2. Fetch User Role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const role = (profile as any)?.role || 'tenant';

    // 3. Build History
    // TODO: Fetch messages properly ordered
    const history = [{ role: 'user', content: `Ticket: ${ticket.titre} - ${ticket.description}` }];

    // 4. Run Graph
    const state: MessageDraftState = {
      ticketId,
      messageHistory: history,
      senderRole: role,
      context: ticket.description.toLowerCase().includes('fuite') ? 'fuite' : 'general'
    };

    const result = await messageDraftGraph.invoke(state);
    return result.draftResponse;
  }
}

export const messagingAiService = new MessagingAiService();


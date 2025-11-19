import { maintenanceGraph, MaintenanceState } from "./maintenance.graph";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export class MaintenanceAiService {
  
  /**
   * Run AI analysis on a newly created ticket
   */
  async analyzeAndEnrichTicket(ticketId: string) {
    const supabase = createClient(cookies());

    // 1. Fetch Ticket
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (!ticket) return;

    // 2. Run Graph
    const initialState: MaintenanceState = {
      ticketId,
      title: ticket.titre,
      description: ticket.description
    };

    try {
      const result = await maintenanceGraph.invoke(initialState);
      
      // 3. Update Ticket with AI insights
      await supabase
        .from("tickets")
        .update({
          ai_summary: result.summary,
          ai_suggested_action: result.suggestedAction,
          ai_suggested_provider_type: result.suggestedProviderTypes,
          // Optionally update priority if AI thinks it's urgent (be careful with overriding user input)
          // priorite: result.priority 
        })
        .eq("id", ticketId);

      return result;

    } catch (error) {
      console.error("[MaintenanceAiService] Analysis failed:", error);
    }
  }
}

export const maintenanceAiService = new MaintenanceAiService();


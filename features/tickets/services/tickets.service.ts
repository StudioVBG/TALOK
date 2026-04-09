import { apiClient } from "@/lib/api-client";
import type { Ticket, TicketStatus, TicketPriority, TicketCategory, TicketComment } from "@/lib/types";

export interface CreateTicketData {
  property_id: string;
  lease_id?: string | null;
  titre: string;
  description: string;
  category?: TicketCategory | null;
  priorite: TicketPriority;
  photos?: string[];
}

export interface UpdateTicketData {
  titre?: string;
  description?: string;
  category?: TicketCategory | null;
  priorite?: TicketPriority;
  resolution_notes?: string;
  satisfaction_rating?: number;
}

export class TicketsService {
  async getTickets(): Promise<Ticket[]> {
    const response = await apiClient.get<{ tickets: Ticket[] }>("/tickets");
    return response.tickets;
  }

  async getTicketById(id: string): Promise<Ticket> {
    const response = await apiClient.get<{ ticket: Ticket }>(`/tickets/${id}`);
    return response.ticket;
  }

  async getTicketsByProperty(propertyId: string): Promise<Ticket[]> {
    const tickets = await this.getTickets();
    return tickets.filter((t) => t.property_id === propertyId);
  }

  async getTicketsByOwner(): Promise<Ticket[]> {
    try {
      return await this.getTickets();
    } catch (error) {
      console.error("[TicketsService] Error fetching owner tickets:", error);
      return [];
    }
  }

  async getTicketsByTenant(): Promise<Ticket[]> {
    try {
      return await this.getTickets();
    } catch (error) {
      console.error("[TicketsService] Error fetching tenant tickets:", error);
      return [];
    }
  }

  async createTicket(data: CreateTicketData): Promise<Ticket> {
    const response = await apiClient.post<{ ticket: Ticket }>("/tickets", data);
    return response.ticket;
  }

  async updateTicket(id: string, data: UpdateTicketData): Promise<Ticket> {
    const response = await apiClient.patch<{ ticket: Ticket }>(`/tickets/${id}`, data);
    return response.ticket;
  }

  async assignTicket(id: string, providerId: string): Promise<Ticket> {
    const response = await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/assign`, {
      provider_id: providerId,
    });
    return response.ticket;
  }

  async resolveTicket(id: string, notes?: string): Promise<Ticket> {
    const response = await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/resolve`, {
      resolution_notes: notes,
    });
    return response.ticket;
  }

  async closeTicket(id: string, satisfactionRating?: number): Promise<Ticket> {
    const response = await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/close`, {
      satisfaction_rating: satisfactionRating,
    });
    return response.ticket;
  }

  async reopenTicket(id: string): Promise<Ticket> {
    const response = await apiClient.post<{ ticket: Ticket }>(`/tickets/${id}/reopen`, {});
    return response.ticket;
  }

  async getComments(ticketId: string): Promise<TicketComment[]> {
    const response = await apiClient.get<{ comments: TicketComment[] }>(
      `/tickets/${ticketId}/comments`
    );
    return response.comments;
  }

  async addComment(
    ticketId: string,
    content: string,
    isInternal?: boolean
  ): Promise<TicketComment> {
    const response = await apiClient.post<{ comment: TicketComment }>(
      `/tickets/${ticketId}/comments`,
      { content, is_internal: isInternal || false }
    );
    return response.comment;
  }

  async createWorkOrder(
    ticketId: string,
    data: { provider_id: string; date_intervention_prevue?: string; cout_estime?: number }
  ) {
    const response = await apiClient.post<{ work_order: any }>(
      `/tickets/${ticketId}/create-work-order`,
      data
    );
    return response.work_order;
  }

  async getKPIs() {
    const response = await apiClient.get<{ kpis: any }>("/tickets/kpis");
    return response.kpis;
  }

  async deleteTicket(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/tickets/${id}`);
  }
}

export const ticketsService = new TicketsService();

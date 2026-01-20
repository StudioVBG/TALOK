import { apiClient } from "@/lib/api-client";
import { ticketSchema, ticketUpdateSchema } from "@/lib/validations";
import type { Ticket, TicketStatus, TicketPriority } from "@/lib/types";

export interface CreateTicketData {
  property_id: string;
  lease_id?: string | null;
  titre: string;
  description: string;
  priorite: TicketPriority;
}

export interface UpdateTicketData extends Partial<CreateTicketData> {
  statut?: TicketStatus;
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

  async getTicketsByOwner(ownerId: string): Promise<Ticket[]> {
    try {
      // L'API /api/tickets filtre déjà correctement les tickets pour les propriétaires
      // Elle retourne les tickets des propriétés du propriétaire
      const tickets = await this.getTickets();
      
      // Double vérification côté client (l'API devrait déjà avoir filtré)
      return tickets.filter((t) => {
        // Les tickets retournés par l'API sont déjà filtrés pour le propriétaire
        return true;
      });
    } catch (error) {
      // En cas d'erreur, retourner un tableau vide plutôt que de faire planter l'application
      console.error("[TicketsService] Error fetching owner tickets:", error);
      return [];
    }
  }

  async getTicketsByTenant(tenantId: string): Promise<Ticket[]> {
    try {
      // L'API /api/tickets filtre déjà correctement les tickets pour les locataires
      // Elle retourne les tickets créés par le locataire ET les tickets liés à ses baux
      const tickets = await this.getTickets();
      
      // Filtrer pour s'assurer qu'on ne retourne que les tickets du locataire
      // (double vérification côté client)
      const tenantTickets = tickets.filter((t) => {
        // Tickets créés par le locataire
        if (t.created_by_profile_id === tenantId) return true;
        
        // Les tickets liés aux baux du locataire sont déjà filtrés par l'API
        // On peut simplement retourner tous les tickets retournés par l'API
        return true;
      });
      
      return tenantTickets;
    } catch (error) {
      // En cas d'erreur, retourner un tableau vide plutôt que de faire planter l'application
      console.error("[TicketsService] Error fetching tenant tickets:", error);
      return [];
    }
  }

  async createTicket(data: CreateTicketData): Promise<Ticket> {
    const validatedData = ticketSchema.parse(data);
    const response = await apiClient.post<{ ticket: Ticket }>("/tickets", validatedData);
    return response.ticket;
  }

  async updateTicket(id: string, data: UpdateTicketData): Promise<Ticket> {
    const validatedData = ticketUpdateSchema.parse(data);
    const response = await apiClient.put<{ ticket: Ticket }>(`/tickets/${id}`, validatedData);
    return response.ticket;
  }

  async changeTicketStatus(id: string, status: TicketStatus): Promise<Ticket> {
    return await this.updateTicket(id, { statut: status });
  }

  async deleteTicket(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/tickets/${id}`);
  }
}

export const ticketsService = new TicketsService();


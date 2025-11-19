export interface OwnerRow {
  id: string;
  name: string;
  type: "particulier" | "societe";
  email?: string;
  units_count: number;
  active_leases: number;
  age_years?: number | null;
}

export interface TenantRow {
  id: string;
  profile_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  age_years?: number | null;
  property_id?: string;
  property_address?: string;
  lease_id?: string;
  lease_status?: string;
}

export interface VendorRow {
  id: string;
  profile_id: string;
  name: string;
  email?: string;
  phone?: string;
  type_services: string[];
  zones_intervention?: string;
}

export interface PropertyRow {
  id: string;
  ref: string;
  address: string;
  status: string;
  tenants_count: number;
  owner_id: string;
  owner_name?: string;
}

export interface AgeAnalytics {
  role: "owner" | "tenant";
  buckets: Array<{
    bucket: string;
    count: number;
  }>;
  avg?: number;
  median?: number;
}

export class PeopleService {
  /**
   * Récupère les headers d'authentification avec le token
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    
    return headers;
  }

  /**
   * Liste des propriétaires avec statistiques
   */
  async getOwners(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: OwnerRow[]; total: number }> {
    const { search = "", page = 1, limit = 50 } = params || {};

    // Utiliser l'API serveur au lieu d'appeler directement Supabase
    const searchParams = new URLSearchParams({
      search,
      page: page.toString(),
      limit: limit.toString(),
    });

    const headers = await this.getAuthHeaders();
    const response = await fetch(`/api/admin/people/owners?${searchParams.toString()}`, {
      credentials: "include", // Important : inclure les cookies pour l'authentification
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la récupération des propriétaires");
    }

    return await response.json();
  }

  /**
   * Détails d'un propriétaire
   * Note: Cette méthode nécessite encore le client Supabase direct
   * TODO: Créer une route API pour cette méthode
   */
  async getOwner(id: string) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`/api/admin/people/owners/${id}`, {
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erreur lors de la récupération du propriétaire");
    }

    return response.json();
  }

  /**
   * Liste des locataires
   */
  async getTenants(params?: {
    search?: string;
    page?: number;
    limit?: number;
    status?: "active" | "all";
  }): Promise<{ items: TenantRow[]; total: number }> {
    const { search = "", page = 1, limit = 50, status = "all" } = params || {};

    // Utiliser l'API serveur au lieu d'appeler directement Supabase
    const searchParams = new URLSearchParams({
      search,
      page: page.toString(),
      limit: limit.toString(),
      status,
    });

    const headers = await this.getAuthHeaders();
    const response = await fetch(`/api/admin/people/tenants?${searchParams.toString()}`, {
      credentials: "include", // Important : inclure les cookies pour l'authentification
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la récupération des locataires");
    }

    return await response.json();
  }

  /**
   * Liste des prestataires
   */
  async getVendors(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: VendorRow[]; total: number }> {
    const { search = "", page = 1, limit = 50 } = params || {};

    // Utiliser l'API serveur au lieu d'appeler directement Supabase
    const searchParams = new URLSearchParams({
      search,
      page: page.toString(),
      limit: limit.toString(),
    });

    const headers = await this.getAuthHeaders();
    const response = await fetch(`/api/admin/people/vendors?${searchParams.toString()}`, {
      credentials: "include", // Important : inclure les cookies pour l'authentification
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la récupération des prestataires");
    }

    return await response.json();
  }

  /**
   * Détail d'un prestataire
   */
  async getVendor(id: string) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`/api/admin/people/vendors/${id}`, {
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erreur lors de la récupération du prestataire");
    }

    return response.json();
  }

  /**
   * Logements d'un propriétaire
   * Utilise la route API /api/admin/people/owners/[id]/properties
   */
  async getOwnerProperties(ownerId: string) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/admin/people/owners/${ownerId}/properties`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la récupération des propriétés");
    }

    const data = await response.json();
    return data.properties || [];
  }

  /**
   * Locataires d'un logement
   * Utilise la route API /api/admin/properties/[id]/tenants
   */
  async getPropertyTenants(propertyId: string) {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/admin/properties/${propertyId}/tenants`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la récupération des locataires");
    }

    const data = await response.json();
    return data.tenants || [];
  }

  /**
   * Analytics d'âge
   * Utilise la route API /api/admin/analytics/age
   */
  async getAgeAnalytics(role: "owner" | "tenant"): Promise<AgeAnalytics> {
    const headers = await this.getAuthHeaders();
    const url = new URL(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/admin/analytics/age`
    );
    url.searchParams.set("role", role);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la récupération des analytics");
    }

    const data = await response.json();
    return data;
  }
}

export const peopleService = new PeopleService();


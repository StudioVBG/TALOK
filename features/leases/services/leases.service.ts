import { apiClient } from "@/lib/api-client";
import { leaseSchema } from "@/lib/validations";
import type { Lease, LeaseSigner, LeaseType, LeaseStatus } from "@/lib/types";

export interface CreateLeaseData {
  property_id?: string | null;
  unit_id?: string | null;
  type_bail: LeaseType;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin?: string | null;
  // ✅ FIX: Ajout des champs locataire
  tenant_email?: string;
  tenant_name?: string;
  tenant_profile_id?: string;
}

export interface UpdateLeaseData extends Partial<CreateLeaseData> {
  statut?: LeaseStatus;
}

export interface AddSignerData {
  profile_id: string;
  role: "proprietaire" | "locataire_principal" | "colocataire" | "garant";
}

export class LeasesService {
  async getLeases() {
    const response = await apiClient.get<{ leases: Lease[] }>("/leases");
    return response.leases;
  }

  async getLeaseById(id: string) {
    const response = await apiClient.get<{ lease: Lease }>(`/leases/${id}`);
    return response.lease;
  }

  async getLeasesByProperty(propertyId: string) {
    const response = await apiClient.get<{ leases: Lease[] }>(
      `/leases?propertyId=${encodeURIComponent(propertyId)}`
    );
    return response.leases;
  }

  async getLeasesByOwner(ownerId: string) {
    const response = await apiClient.get<{ leases: Lease[] }>(
      `/leases?owner_id=${encodeURIComponent(ownerId)}`
    );
    return response.leases;
  }

  async getLeasesByTenant(tenantId: string) {
    const response = await apiClient.get<{ leases: Lease[] }>(
      `/leases?tenant_id=${encodeURIComponent(tenantId)}`
    );
    return response.leases;
  }

  async createLease(data: CreateLeaseData) {
    const validatedData = leaseSchema.parse(data);
    const response = await apiClient.post<{ lease: Lease }>(
      "/leases",
      validatedData
    );
    return response.lease;
  }

  async updateLease(id: string, data: UpdateLeaseData) {
    const validatedData = leaseSchema.partial().parse(data);
    const response = await apiClient.patch<{ lease: Lease }>(`/leases/${id}`, validatedData);
    return response.lease;
  }

  async deleteLease(id: string) {
    await apiClient.delete(`/leases/${id}`);
  }

  async getLeaseSigners(leaseId: string) {
    const response = await apiClient.get<{ signers: (LeaseSigner & { profiles: any })[] }>(
      `/leases/${leaseId}/signers`
    );
    return response.signers;
  }

  async addSigner(leaseId: string, signerData: AddSignerData) {
    const response = await apiClient.post<{ signer: LeaseSigner }>(
      `/leases/${leaseId}/signers`,
      signerData
    );
    return response.signer;
  }

  async removeSigner(leaseId: string, signerId: string) {
    await apiClient.delete(`/leases/${leaseId}/signers/${signerId}`);
  }

  async signLease(leaseId: string, signerId?: string) {
    // Utiliser la route API existante pour signer
    // La route API gère automatiquement le signataire via le profil de l'utilisateur connecté
    const response = await apiClient.post<{ success: boolean; signature: any }>(
      `/leases/${leaseId}/sign`,
      {
        level: "SES",
      }
    );
    // Récupérer le signataire mis à jour
    const signers = await this.getLeaseSigners(leaseId);
    // ✅ FIX: Gérer le cas où signers est vide pour éviter undefined
    if (!signers || signers.length === 0) {
      throw new Error("Aucun signataire trouvé après signature");
    }
    const updatedSigner = signers.find((s) => s.id === signerId) ?? signers[0];
    return updatedSigner;
  }

  async refuseLease(leaseId: string, signerId: string) {
    // Utiliser la route PATCH pour mettre à jour le statut
    const response = await apiClient.patch<{ signer: LeaseSigner }>(
      `/leases/${leaseId}/signers/${signerId}`,
      {
        signature_status: "refused",
      }
    );
    return response.signer;
  }

  async changeLeaseStatus(leaseId: string, status: LeaseStatus) {
    return await this.updateLease(leaseId, { statut: status });
  }
}

export const leasesService = new LeasesService();


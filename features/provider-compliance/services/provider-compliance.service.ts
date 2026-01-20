// =====================================================
// Service de Compliance Prestataire SOTA 2025
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  ProviderComplianceDocument,
  CreateComplianceDocumentData,
  ProviderPayoutAccount,
  CreatePayoutAccountData,
  KYCRequirement,
  MissingDocument,
  ProviderComplianceStatus,
  ComplianceDocumentType,
  ProviderType,
  KYCStatus,
  ProviderProfileExtended,
} from '@/lib/types/provider-compliance';
import {
  createComplianceDocumentSchema,
  createPayoutAccountSchema,
  updateProviderBusinessInfoSchema,
  verifyDocumentSchema,
  type CreateComplianceDocumentInput,
  type CreatePayoutAccountInput,
  type UpdateProviderBusinessInfoInput,
  type VerifyDocumentInput,
} from '@/lib/validations/provider-compliance';

export class ProviderComplianceService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  // =====================================================
  // Documents
  // =====================================================

  /**
   * Récupérer tous les documents d'un prestataire
   */
  async getDocuments(providerId: string): Promise<ProviderComplianceDocument[]> {
    const { data, error } = await this.supabase
      .from('provider_compliance_documents')
      .select('*')
      .eq('provider_profile_id', providerId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data as ProviderComplianceDocument[];
  }

  /**
   * Récupérer un document spécifique
   */
  async getDocument(documentId: string): Promise<ProviderComplianceDocument | null> {
    const { data, error } = await this.supabase
      .from('provider_compliance_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data as ProviderComplianceDocument | null;
  }

  /**
   * Créer un nouveau document
   */
  async createDocument(
    providerId: string,
    input: CreateComplianceDocumentInput
  ): Promise<ProviderComplianceDocument> {
    const validated = createComplianceDocumentSchema.parse(input);

    const { data, error } = await this.supabase
      .from('provider_compliance_documents')
      .insert({
        provider_profile_id: providerId,
        ...validated,
        verification_status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ProviderComplianceDocument;
  }

  /**
   * Supprimer un document (seulement si pending)
   */
  async deleteDocument(documentId: string, providerId: string): Promise<void> {
    const { error } = await this.supabase
      .from('provider_compliance_documents')
      .delete()
      .eq('id', documentId)
      .eq('provider_profile_id', providerId)
      .eq('verification_status', 'pending');

    if (error) throw new Error(error.message);
  }

  /**
   * Upload un fichier et créer le document
   */
  async uploadDocument(
    providerId: string,
    file: File,
    documentType: ComplianceDocumentType,
    options?: {
      issueDate?: string;
      expirationDate?: string;
    }
  ): Promise<ProviderComplianceDocument> {
    // 1. Upload le fichier
    const fileExt = file.name.split('.').pop();
    const fileName = `${providerId}/${documentType}-${Date.now()}.${fileExt}`;
    const filePath = `provider-compliance/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new Error(`Erreur upload: ${uploadError.message}`);

    // 2. Créer le document
    return this.createDocument(providerId, {
      document_type: documentType,
      storage_path: filePath,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      issue_date: options?.issueDate,
      expiration_date: options?.expirationDate,
    });
  }

  /**
   * Obtenir l'URL de téléchargement d'un document
   */
  async getDocumentUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600); // 1 heure

    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  // =====================================================
  // Comptes de paiement
  // =====================================================

  /**
   * Récupérer les comptes de paiement d'un prestataire
   */
  async getPayoutAccounts(providerId: string): Promise<ProviderPayoutAccount[]> {
    const { data, error } = await this.supabase
      .from('provider_payout_accounts')
      .select('*')
      .eq('provider_profile_id', providerId)
      .order('is_default', { ascending: false });

    if (error) throw new Error(error.message);
    return data as ProviderPayoutAccount[];
  }

  /**
   * Créer un compte de paiement
   */
  async createPayoutAccount(
    providerId: string,
    input: CreatePayoutAccountInput
  ): Promise<ProviderPayoutAccount> {
    const validated = createPayoutAccountSchema.parse(input);

    // Si c'est le premier compte ou is_default=true, désactiver les autres
    if (validated.is_default) {
      await this.supabase
        .from('provider_payout_accounts')
        .update({ is_default: false })
        .eq('provider_profile_id', providerId);
    }

    const { data, error } = await this.supabase
      .from('provider_payout_accounts')
      .insert({
        provider_profile_id: providerId,
        ...validated,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ProviderPayoutAccount;
  }

  /**
   * Définir un compte par défaut
   */
  async setDefaultPayoutAccount(providerId: string, accountId: string): Promise<void> {
    // Désactiver tous les comptes par défaut
    await this.supabase
      .from('provider_payout_accounts')
      .update({ is_default: false })
      .eq('provider_profile_id', providerId);

    // Activer le compte sélectionné
    const { error } = await this.supabase
      .from('provider_payout_accounts')
      .update({ is_default: true })
      .eq('id', accountId)
      .eq('provider_profile_id', providerId);

    if (error) throw new Error(error.message);
  }

  // =====================================================
  // Profil entreprise
  // =====================================================

  /**
   * Mettre à jour les informations entreprise du prestataire
   */
  async updateBusinessInfo(
    providerId: string,
    input: UpdateProviderBusinessInfoInput
  ): Promise<ProviderProfileExtended> {
    const validated = updateProviderBusinessInfoSchema.parse(input);

    const { data, error } = await this.supabase
      .from('provider_profiles')
      .update(validated)
      .eq('profile_id', providerId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ProviderProfileExtended;
  }

  /**
   * Récupérer le profil complet du prestataire
   */
  async getProviderProfile(providerId: string): Promise<ProviderProfileExtended | null> {
    const { data, error } = await this.supabase
      .from('provider_profiles')
      .select('*')
      .eq('profile_id', providerId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data as ProviderProfileExtended | null;
  }

  // =====================================================
  // KYC & Compliance
  // =====================================================

  /**
   * Récupérer les documents requis pour un type de prestataire
   */
  async getKYCRequirements(providerType: ProviderType): Promise<KYCRequirement[]> {
    const { data, error } = await this.supabase
      .from('provider_kyc_requirements')
      .select('*')
      .eq('provider_type', providerType)
      .order('is_required', { ascending: false });

    if (error) throw new Error(error.message);
    return data as KYCRequirement[];
  }

  /**
   * Récupérer les documents manquants pour un prestataire
   */
  async getMissingDocuments(providerId: string): Promise<MissingDocument[]> {
    const { data, error } = await this.supabase.rpc('get_provider_missing_documents', {
      p_provider_profile_id: providerId,
    });

    if (error) throw new Error(error.message);
    return data as MissingDocument[];
  }

  /**
   * Calculer le score de compliance
   */
  async calculateComplianceScore(providerId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('calculate_provider_compliance_score', {
      p_provider_profile_id: providerId,
    });

    if (error) throw new Error(error.message);
    return data as number;
  }

  /**
   * Mettre à jour le statut KYC
   */
  async updateKYCStatus(providerId: string): Promise<KYCStatus> {
    const { data, error } = await this.supabase.rpc('update_provider_kyc_status', {
      p_provider_profile_id: providerId,
    });

    if (error) throw new Error(error.message);
    return data as KYCStatus;
  }

  /**
   * Récupérer le statut de compliance complet
   */
  async getComplianceStatus(providerId: string): Promise<ProviderComplianceStatus | null> {
    const { data, error } = await this.supabase
      .from('provider_compliance_status')
      .select('*')
      .eq('profile_id', providerId)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data as ProviderComplianceStatus | null;
  }

  // =====================================================
  // Admin: Validation des documents
  // =====================================================

  /**
   * Valider ou rejeter un document (admin)
   */
  async verifyDocument(
    documentId: string,
    input: VerifyDocumentInput,
    adminUserId: string
  ): Promise<ProviderComplianceDocument> {
    const validated = verifyDocumentSchema.parse(input);

    const updateData: Record<string, unknown> = {
      verification_status: validated.action === 'approve' ? 'verified' : 'rejected',
      verified_at: new Date().toISOString(),
      verified_by: adminUserId,
    };

    if (validated.action === 'reject' && validated.rejection_reason) {
      updateData.rejection_reason = validated.rejection_reason;
    }

    const { data, error } = await this.supabase
      .from('provider_compliance_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as ProviderComplianceDocument;
  }

  /**
   * Récupérer les documents en attente de validation (admin)
   */
  async getPendingDocuments(): Promise<
    (ProviderComplianceDocument & { provider_name: string; provider_email: string })[]
  > {
    const { data, error } = await this.supabase
      .from('provider_compliance_documents')
      .select(
        `
        *,
        profiles!provider_compliance_documents_provider_profile_id_fkey (
          prenom,
          nom,
          user_id
        )
      `
      )
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    // Formater les données
    return (data || []).map((doc: any) => ({
      ...doc,
      provider_name: `${doc.profiles?.prenom || ''} ${doc.profiles?.nom || ''}`.trim() || 'Inconnu',
      provider_email: '', // À récupérer séparément si nécessaire
      profiles: undefined,
    }));
  }

  /**
   * Récupérer les documents qui expirent bientôt (admin)
   */
  async getExpiringDocuments(daysAhead: number = 30): Promise<
    {
      provider_profile_id: string;
      provider_name: string;
      document_type: ComplianceDocumentType;
      document_id: string;
      expiration_date: string;
      days_until_expiry: number;
    }[]
  > {
    const { data, error } = await this.supabase.rpc('get_expiring_provider_documents', {
      p_days_ahead: daysAhead,
    });

    if (error) throw new Error(error.message);
    return data || [];
  }

  /**
   * Suspendre un prestataire (admin)
   */
  async suspendProvider(
    providerId: string,
    reason: string,
    until?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('provider_profiles')
      .update({
        kyc_status: 'suspended',
        suspension_reason: reason,
        suspension_until: until,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', providerId);

    if (error) throw new Error(error.message);
  }

  /**
   * Réactiver un prestataire suspendu (admin)
   */
  async reactivateProvider(providerId: string): Promise<void> {
    // D'abord recalculer le statut KYC
    const newStatus = await this.updateKYCStatus(providerId);

    // Si toujours suspendu (documents expirés), ne pas réactiver
    if (newStatus === 'suspended') {
      throw new Error('Impossible de réactiver: des documents sont toujours expirés');
    }

    const { error } = await this.supabase
      .from('provider_profiles')
      .update({
        suspension_reason: null,
        suspension_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', providerId);

    if (error) throw new Error(error.message);
  }
}

// Instance singleton
export const providerComplianceService = new ProviderComplianceService();


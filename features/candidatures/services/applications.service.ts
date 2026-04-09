/**
 * Service CRUD pour les candidatures (applications)
 */

import { createClient } from '@/lib/supabase/client';
import type {
  Application,
  ApplicationWithListing,
  ApplicationStatus,
  CreateApplicationInput,
  CompareApplicationsResult,
} from '@/lib/types/candidatures';

export class CandidaturesService {
  private supabase = createClient();

  /**
   * Récupérer les candidatures pour une annonce
   */
  async getApplicationsForListing(listingId: string): Promise<Application[]> {
    const { data, error } = await this.supabase
      .from('applications')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as Application[]) || [];
  }

  /**
   * Récupérer toutes les candidatures du propriétaire
   */
  async getMyApplications(): Promise<ApplicationWithListing[]> {
    const { data, error } = await this.supabase
      .from('applications')
      .select(`
        *,
        listing:property_listings!inner(
          id, title, rent_amount_cents, charges_cents, bail_type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as unknown as ApplicationWithListing[]) || [];
  }

  /**
   * Récupérer une candidature par ID
   */
  async getApplication(id: string): Promise<Application | null> {
    const { data, error } = await this.supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as unknown as Application;
  }

  /**
   * Créer une candidature (peut être appelé sans authentification)
   */
  async createApplication(input: CreateApplicationInput): Promise<Application> {
    // Récupérer le listing pour obtenir property_id et owner_id
    const { data: listing, error: listingError } = await this.supabase
      .from('property_listings')
      .select('property_id, owner_id')
      .eq('id', input.listing_id)
      .eq('is_published', true)
      .single();

    if (listingError || !listing) {
      throw new Error('Annonce introuvable ou non publiée');
    }

    const listingData = listing as any;

    // Vérifier si le candidat est authentifié
    let applicantProfileId: string | null = null;
    const { data: { user } } = await this.supabase.auth.getUser();
    if (user) {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (profile) {
        applicantProfileId = profile.id as string;
      }
    }

    const { data, error } = await this.supabase
      .from('applications')
      .insert({
        listing_id: input.listing_id,
        property_id: listingData.property_id,
        owner_id: listingData.owner_id,
        applicant_profile_id: applicantProfileId,
        applicant_name: input.applicant_name,
        applicant_email: input.applicant_email,
        applicant_phone: input.applicant_phone || null,
        message: input.message || null,
        documents: input.documents || [],
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Application;
  }

  /**
   * Accepter une candidature → déclenche la création du bail
   */
  async acceptApplication(id: string): Promise<Application> {
    const { data, error } = await this.supabase
      .from('applications')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Application;
  }

  /**
   * Refuser une candidature
   */
  async rejectApplication(id: string, reason?: string): Promise<Application> {
    const { data, error } = await this.supabase
      .from('applications')
      .update({
        status: 'rejected',
        rejection_reason: reason || null,
        rejected_at: new Date().toISOString(),
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Application;
  }

  /**
   * Mettre à jour le statut d'une candidature
   */
  async updateStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const { data, error } = await this.supabase
      .from('applications')
      .update({ status } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Application;
  }

  /**
   * Comparer plusieurs candidatures côte à côte
   */
  async compareApplications(applicationIds: string[]): Promise<CompareApplicationsResult> {
    const { data, error } = await this.supabase
      .from('applications')
      .select('*')
      .in('id', applicationIds)
      .order('completeness_score', { ascending: false });

    if (error) throw error;

    const applications = (data as unknown as Application[]) || [];

    // Calculer le ranking
    const ranking = applications
      .map((app) => ({
        application_id: app.id,
        applicant_name: app.applicant_name,
        completeness_score: app.completeness_score,
        ai_score: app.ai_score,
        total_score: app.ai_score
          ? Math.round(app.completeness_score * 0.4 + app.ai_score * 0.6)
          : app.completeness_score,
        rank: 0,
      }))
      .sort((a, b) => b.total_score - a.total_score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return { applications, ranking };
  }

  /**
   * Retirer une candidature (par le candidat)
   */
  async withdrawApplication(id: string): Promise<Application> {
    const { data, error } = await this.supabase
      .from('applications')
      .update({ status: 'withdrawn' } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Application;
  }
}

export const candidaturesService = new CandidaturesService();

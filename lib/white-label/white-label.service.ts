/**
 * Service White-Label
 *
 * Gère la vérification des droits et l'accès aux fonctionnalités white-label
 * en fonction du niveau d'abonnement.
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createClientBrowser } from '@/lib/supabase/client';
import {
  WhiteLabelLevel,
  WhiteLabelFeature,
  OrganizationBranding,
  CustomDomain,
  Organization,
  hasWhiteLabelFeature,
  planToWhiteLabelLevel,
  WHITE_LABEL_FEATURES,
  WHITE_LABEL_LEVEL_INFO,
  DEFAULT_BRANDING,
} from './types';

// ============================================
// SERVICE CÔTÉ SERVEUR
// ============================================

export class WhiteLabelService {
  private supabase: Awaited<ReturnType<typeof createClient>>;

  constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  /**
   * Obtient le niveau white-label d'un utilisateur via son abonnement
   */
  async getUserWhiteLabelLevel(userId: string): Promise<WhiteLabelLevel> {
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('plan_id, subscription_plans(slug)')
      .eq('owner_id', userId)
      .eq('status', 'active')
      .single();

    if (!subscription?.subscription_plans) {
      return 'none';
    }

    const planSlug = (subscription.subscription_plans as any).slug;
    return planToWhiteLabelLevel(planSlug);
  }

  /**
   * Obtient l'organisation d'un utilisateur
   */
  async getUserOrganization(userId: string): Promise<Organization | null> {
    // D'abord chercher si l'utilisateur est propriétaire
    const { data: ownedOrg } = await this.supabase
      .from('organizations')
      .select(`
        *,
        branding:organization_branding(*),
        domains:custom_domains(*)
      `)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .single();

    if (ownedOrg) {
      return ownedOrg as unknown as Organization;
    }

    // Sinon chercher si l'utilisateur est membre
    const { data: membership } = await this.supabase
      .from('organization_members')
      .select(`
        organization:organizations(
          *,
          branding:organization_branding(*),
          domains:custom_domains(*)
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (membership?.organization) {
      return membership.organization as unknown as Organization;
    }

    return null;
  }

  /**
   * Vérifie si une feature est disponible pour un utilisateur
   */
  async canUseFeature(userId: string, feature: WhiteLabelFeature): Promise<boolean> {
    const level = await this.getUserWhiteLabelLevel(userId);
    return hasWhiteLabelFeature(level, feature);
  }

  /**
   * Vérifie si une feature est disponible pour une organisation
   */
  async canOrganizationUseFeature(
    organizationId: string,
    feature: WhiteLabelFeature
  ): Promise<boolean> {
    const { data: org } = await this.supabase
      .from('organizations')
      .select('white_label_level')
      .eq('id', organizationId)
      .single();

    if (!org) return false;

    return hasWhiteLabelFeature(org.white_label_level as WhiteLabelLevel, feature);
  }

  /**
   * Obtient le branding d'une organisation
   */
  async getOrganizationBranding(organizationId: string): Promise<OrganizationBranding | null> {
    const { data } = await this.supabase
      .from('organization_branding')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    return data as OrganizationBranding | null;
  }

  /**
   * Obtient le branding effectif (avec fallback aux valeurs par défaut)
   */
  async getEffectiveBranding(organizationId: string): Promise<Partial<OrganizationBranding>> {
    const branding = await this.getOrganizationBranding(organizationId);

    if (!branding) {
      return DEFAULT_BRANDING;
    }

    return {
      ...DEFAULT_BRANDING,
      ...Object.fromEntries(
        Object.entries(branding).filter(([_, v]) => v !== null)
      ),
    };
  }

  /**
   * Obtient l'organisation par domaine personnalisé
   */
  async getOrganizationByDomain(domain: string): Promise<Organization | null> {
    const { data } = await this.supabase
      .from('custom_domains')
      .select(`
        organization:organizations(
          *,
          branding:organization_branding(*),
          domains:custom_domains(*)
        )
      `)
      .eq('domain', domain)
      .eq('verified', true)
      .eq('is_active', true)
      .single();

    if (data?.organization) {
      return data.organization as unknown as Organization;
    }

    return null;
  }

  /**
   * Crée une organisation pour un utilisateur
   */
  async createOrganization(
    userId: string,
    name: string,
    slug: string
  ): Promise<Organization | null> {
    // Vérifier le niveau white-label
    const level = await this.getUserWhiteLabelLevel(userId);
    if (level === 'none') {
      throw new Error('White-label non disponible pour votre abonnement');
    }

    // Récupérer l'abonnement
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('id')
      .eq('owner_id', userId)
      .eq('status', 'active')
      .single();

    // Créer l'organisation
    const { data: org, error } = await this.supabase
      .from('organizations')
      .insert({
        name,
        slug,
        owner_id: userId,
        subscription_id: subscription?.id,
        white_label_level: level,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur création organisation: ${error.message}`);
    }

    // Ajouter le créateur comme membre owner
    await this.supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
      });

    return org as Organization;
  }

  /**
   * Met à jour le branding (avec vérification des droits)
   */
  async updateBranding(
    organizationId: string,
    userId: string,
    updates: Partial<OrganizationBranding>
  ): Promise<OrganizationBranding | null> {
    // Vérifier que l'utilisateur a accès
    const org = await this.getUserOrganization(userId);
    if (!org || org.id !== organizationId) {
      throw new Error('Accès non autorisé');
    }

    // Vérifier les features pour chaque champ
    const level = org.white_label_level;
    const allowedUpdates: Partial<OrganizationBranding> = {};

    // Mapping champ -> feature requise
    const fieldToFeature: Record<string, WhiteLabelFeature> = {
      company_name: 'company_name',
      logo_url: 'custom_logo',
      logo_dark_url: 'custom_logo',
      primary_color: 'primary_color',
      email_from_name: 'custom_email_from',
      email_from_address: 'custom_email_from',
      email_logo_url: 'custom_email_logo',
      favicon_url: 'custom_favicon',
      secondary_color: 'secondary_color',
      accent_color: 'accent_color',
      email_footer_html: 'custom_email_footer',
      email_primary_color: 'custom_email_colors',
      email_secondary_color: 'custom_email_colors',
      remove_powered_by: 'remove_powered_by',
      login_background_url: 'branded_login_page',
      login_background_color: 'branded_login_page',
      custom_css: 'custom_css',
      sso_enabled: 'sso_saml',
      sso_provider: 'sso_saml',
      sso_config: 'sso_saml',
    };

    for (const [field, value] of Object.entries(updates)) {
      const requiredFeature = fieldToFeature[field];
      if (!requiredFeature || hasWhiteLabelFeature(level, requiredFeature)) {
        (allowedUpdates as any)[field] = value;
      }
    }

    const { data, error } = await this.supabase
      .from('organization_branding')
      .update(allowedUpdates)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur mise à jour branding: ${error.message}`);
    }

    return data as OrganizationBranding;
  }

  /**
   * Ajoute un domaine personnalisé
   */
  async addCustomDomain(
    organizationId: string,
    userId: string,
    domain: string
  ): Promise<CustomDomain | null> {
    // Vérifier le droit custom_domain
    const canUseDomain = await this.canOrganizationUseFeature(organizationId, 'custom_domain');
    if (!canUseDomain) {
      throw new Error('Domaine personnalisé non disponible pour votre forfait');
    }

    // Vérifier que l'utilisateur a accès à l'organisation
    const org = await this.getUserOrganization(userId);
    if (!org || org.id !== organizationId) {
      throw new Error('Accès non autorisé');
    }

    // Créer le domaine
    const { data, error } = await this.supabase
      .from('custom_domains')
      .insert({
        organization_id: organizationId,
        domain: domain.toLowerCase(),
        is_primary: !(org.domains && org.domains.length > 0),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur ajout domaine: ${error.message}`);
    }

    return data as CustomDomain;
  }

  /**
   * Vérifie un domaine personnalisé
   */
  async verifyDomain(domainId: string): Promise<{ verified: boolean; error?: string }> {
    const { data: domain } = await this.supabase
      .from('custom_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (!domain) {
      return { verified: false, error: 'Domaine non trouvé' };
    }

    // Incrémenter les tentatives
    await this.supabase
      .from('custom_domains')
      .update({
        verification_attempts: domain.verification_attempts + 1,
        last_verification_at: new Date().toISOString(),
      })
      .eq('id', domainId);

    // Vérification DNS (simplifiée - en production utiliser une lib DNS)
    try {
      // En production : vérifier le TXT record
      // const records = await dns.resolveTxt(domain.domain);
      // const hasToken = records.some(r => r.includes(domain.verification_token));

      // Pour l'instant, simuler la vérification
      const isVerified = true; // À implémenter avec vraie vérification DNS

      if (isVerified) {
        await this.supabase
          .from('custom_domains')
          .update({
            verified: true,
            verified_at: new Date().toISOString(),
            ssl_status: 'pending', // Déclencher provisioning SSL
          })
          .eq('id', domainId);

        return { verified: true };
      }

      return { verified: false, error: 'Enregistrement DNS non trouvé' };
    } catch (err) {
      return { verified: false, error: 'Erreur vérification DNS' };
    }
  }

  /**
   * Obtient les features disponibles et non disponibles
   */
  async getFeatureAvailability(userId: string): Promise<{
    level: WhiteLabelLevel;
    available: WhiteLabelFeature[];
    unavailable: WhiteLabelFeature[];
    nextLevel: WhiteLabelLevel | null;
    nextLevelFeatures: WhiteLabelFeature[];
  }> {
    const level = await this.getUserWhiteLabelLevel(userId);
    const available = WHITE_LABEL_FEATURES[level];

    // Toutes les features possibles
    const allFeatures = WHITE_LABEL_FEATURES.premium;
    const unavailable = allFeatures.filter(f => !available.includes(f));

    // Niveau suivant
    let nextLevel: WhiteLabelLevel | null = null;
    let nextLevelFeatures: WhiteLabelFeature[] = [];

    if (level === 'none') {
      nextLevel = 'basic';
      nextLevelFeatures = WHITE_LABEL_FEATURES.basic;
    } else if (level === 'basic') {
      nextLevel = 'full';
      nextLevelFeatures = WHITE_LABEL_FEATURES.full.filter(f => !available.includes(f));
    } else if (level === 'full') {
      nextLevel = 'premium';
      nextLevelFeatures = WHITE_LABEL_FEATURES.premium.filter(f => !available.includes(f));
    }

    return {
      level,
      available,
      unavailable,
      nextLevel,
      nextLevelFeatures,
    };
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Crée une instance du service côté serveur
 */
export async function createWhiteLabelService(): Promise<WhiteLabelService> {
  const supabase = await createClient();
  return new WhiteLabelService(supabase);
}

// ============================================
// CLIENT-SIDE SERVICE
// ============================================

export class WhiteLabelClientService {
  private supabase: ReturnType<typeof createClientBrowser>;

  constructor() {
    this.supabase = createClientBrowser();
  }

  /**
   * Obtient le branding de l'organisation courante
   */
  async getCurrentBranding(): Promise<Partial<OrganizationBranding> | null> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return null;

    // Chercher l'organisation de l'utilisateur
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) return null;

    const { data: branding } = await this.supabase
      .from('organization_branding')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .single();

    return branding;
  }

  /**
   * Met à jour le branding
   */
  async updateBranding(
    organizationId: string,
    updates: Partial<OrganizationBranding>
  ): Promise<OrganizationBranding | null> {
    const { data, error } = await this.supabase
      .from('organization_branding')
      .update(updates)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Upload un asset de branding
   */
  async uploadBrandingAsset(
    organizationId: string,
    assetType: 'logo' | 'favicon' | 'login_bg' | 'email_logo',
    file: File
  ): Promise<string> {
    const fileName = `${organizationId}/${assetType}-${Date.now()}.${file.name.split('.').pop()}`;

    const { error: uploadError } = await this.supabase.storage
      .from('branding-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = this.supabase.storage
      .from('branding-assets')
      .getPublicUrl(fileName);

    // Enregistrer l'asset
    await this.supabase
      .from('branding_assets')
      .insert({
        organization_id: organizationId,
        asset_type: assetType,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
      });

    return publicUrl;
  }

  /**
   * Ajoute un domaine personnalisé
   */
  async addDomain(organizationId: string, domain: string): Promise<CustomDomain> {
    const { data, error } = await this.supabase
      .from('custom_domains')
      .insert({
        organization_id: organizationId,
        domain: domain.toLowerCase(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Supprime un domaine
   */
  async removeDomain(domainId: string): Promise<void> {
    const { error } = await this.supabase
      .from('custom_domains')
      .delete()
      .eq('id', domainId);

    if (error) throw error;
  }
}

// Singleton pour le client
let clientService: WhiteLabelClientService | null = null;

export function getWhiteLabelClientService(): WhiteLabelClientService {
  if (!clientService) {
    clientService = new WhiteLabelClientService();
  }
  return clientService;
}

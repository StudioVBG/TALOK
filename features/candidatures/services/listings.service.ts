/**
 * Service CRUD pour les annonces (property_listings)
 */

import { createClient } from '@/lib/supabase/client';
import { fetchPropertyCoverUrl, fetchPropertyCoverUrls } from '@/lib/properties/cover-url';
import type {
  PropertyListing,
  PropertyListingWithProperty,
  CreateListingInput,
  UpdateListingInput,
} from '@/lib/types/candidatures';

export class ListingsService {
  private supabase = createClient();

  /**
   * Récupérer toutes les annonces du propriétaire
   */
  async getMyListings(): Promise<PropertyListingWithProperty[]> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .select(`
        *,
        property:properties!inner(
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const listings = (data as unknown as PropertyListingWithProperty[]) || [];
    const coverMap = await fetchPropertyCoverUrls(
      this.supabase,
      listings.map((l) => l.property?.id).filter((id): id is string => !!id),
    );
    for (const l of listings) {
      if (l.property) l.property.cover_url = coverMap.get(l.property.id) ?? null;
    }
    return listings;
  }

  /**
   * Récupérer une annonce par ID
   */
  async getListing(id: string): Promise<PropertyListingWithProperty | null> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .select(`
        *,
        property:properties!inner(
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    const listing = data as unknown as PropertyListingWithProperty;
    if (listing.property) {
      listing.property.cover_url = await fetchPropertyCoverUrl(this.supabase, listing.property.id);
    }
    return listing;
  }

  /**
   * Récupérer une annonce par token public (page publique)
   */
  async getListingByToken(token: string): Promise<PropertyListingWithProperty | null> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .select(`
        *,
        property:properties!inner(
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces
        )
      `)
      .eq('public_url_token', token)
      .eq('is_published', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    const listing = data as unknown as PropertyListingWithProperty;
    if (listing.property) {
      listing.property.cover_url = await fetchPropertyCoverUrl(this.supabase, listing.property.id);
    }
    return listing;
  }

  /**
   * Créer une annonce
   */
  async createListing(input: CreateListingInput): Promise<PropertyListing> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Non authentifié');

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!profile) throw new Error('Profil introuvable');

    const { data, error } = await this.supabase
      .from('property_listings')
      .insert({
        property_id: input.property_id,
        owner_id: profile.id,
        title: input.title,
        description: input.description || null,
        rent_amount_cents: input.rent_amount_cents,
        charges_cents: input.charges_cents || 0,
        available_from: input.available_from,
        bail_type: input.bail_type,
        photos: input.photos || [],
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PropertyListing;
  }

  /**
   * Mettre à jour une annonce
   */
  async updateListing(id: string, input: UpdateListingInput): Promise<PropertyListing> {
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.rent_amount_cents !== undefined) updates.rent_amount_cents = input.rent_amount_cents;
    if (input.charges_cents !== undefined) updates.charges_cents = input.charges_cents;
    if (input.available_from !== undefined) updates.available_from = input.available_from;
    if (input.bail_type !== undefined) updates.bail_type = input.bail_type;
    if (input.photos !== undefined) updates.photos = input.photos;

    const { data, error } = await this.supabase
      .from('property_listings')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PropertyListing;
  }

  /**
   * Publier une annonce
   */
  async publishListing(id: string): Promise<PropertyListing> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .update({ is_published: true } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PropertyListing;
  }

  /**
   * Dépublier une annonce
   */
  async unpublishListing(id: string): Promise<PropertyListing> {
    const { data, error } = await this.supabase
      .from('property_listings')
      .update({ is_published: false } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as PropertyListing;
  }

  /**
   * Supprimer une annonce
   */
  async deleteListing(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('property_listings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const listingsService = new ListingsService();

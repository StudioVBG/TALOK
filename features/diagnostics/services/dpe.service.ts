import { createClient } from "@/lib/supabase/client";
import { 
  DpeRequestInput, 
  DpeDeliverableInput,
  isValidAdemeNumber
} from "@/lib/validations/dpe";

export class DpeService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Créer une nouvelle demande de DPE
   */
  async createRequest(input: DpeRequestInput) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // Validation basique
    if (!input.visit_contact_name?.trim()) {
      throw new Error("Le nom du contact est requis");
    }
    if (!input.visit_contact_phone || input.visit_contact_phone.length < 10) {
      throw new Error("Téléphone invalide");
    }
    if (!input.preferred_slots || input.preferred_slots.length === 0) {
      throw new Error("Au moins un créneau est requis");
    }

    const { data, error } = await this.supabase
      .from("dpe_requests")
      .insert({
        property_id: input.property_id,
        owner_id: user.id,
        status: "REQUESTED",
        visit_contact_name: input.visit_contact_name,
        visit_contact_role: input.visit_contact_role,
        visit_contact_email: input.visit_contact_email || null,
        visit_contact_phone: input.visit_contact_phone,
        access_notes: input.access_notes || null,
        preferred_slots: input.preferred_slots,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Récupérer les demandes DPE pour un logement
   */
  async getRequestsByProperty(propertyId: string) {
    const { data, error } = await this.supabase
      .from("dpe_requests")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Déposer un livrable DPE
   */
  async uploadDeliverable(input: DpeDeliverableInput, file: File) {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // Validation du numéro ADEME
    if (!isValidAdemeNumber(input.dpe_number)) {
      throw new Error("Le numéro ADEME doit contenir 13 chiffres");
    }

    if (!input.issued_at) {
      throw new Error("La date d'émission est requise");
    }

    // 1. Upload du PDF vers le bucket 'documents'
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `ddt/${user.id}/properties/${input.property_id}/dpe/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    // 2. Création de l'entrée en base
    const { data, error } = await this.supabase
      .from("dpe_deliverables")
      .insert({
        property_id: input.property_id,
        owner_id: user.id,
        request_id: input.request_id || null,
        dpe_number: input.dpe_number,
        issued_at: input.issued_at,
        energy_class: input.energy_class,
        ges_class: input.ges_class || null,
        pdf_path: storagePath,
        source: input.source,
      })
      .select()
      .single();

    if (error) {
      // Nettoyage storage en cas d'échec
      await this.supabase.storage.from("documents").remove([storagePath]);
      throw error;
    }

    // 3. Si lié à une demande, mettre à jour le statut de la demande
    if (input.request_id) {
      await this.supabase
        .from("dpe_requests")
        .update({ status: "DELIVERED" })
        .eq("id", input.request_id);
    }

    return data;
  }

  /**
   * Récupérer le statut DPE actuel d'un logement
   */
  async getLatestDeliverable(propertyId: string) {
    try {
      const { data, error } = await this.supabase
        .from("dpe_deliverables")
        .select("*")
        .eq("property_id", propertyId)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        // Table n'existe pas encore ou autre erreur
        console.warn("DPE check error:", error.message);
        return { status: "MISSING", data: null };
      }
      
      if (!data) return { status: "MISSING", data: null };

      const today = new Date().toISOString().split('T')[0];
      const isExpired = data.valid_until < today;

      return {
        status: isExpired ? "EXPIRED" : "VALID",
        data,
      };
    } catch (err) {
      console.warn("DPE service error:", err);
      return { status: "MISSING", data: null };
    }
  }
}

export const dpeService = new DpeService();

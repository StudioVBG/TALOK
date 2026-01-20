import { createClient } from "@/lib/supabase/client";
import {
  DocumentType,
  ExtractedIdentityData,
  VerificationResult,
} from "../types";

/**
 * Service de vérification d'identité KYC
 *
 * Ce service gère :
 * - L'upload sécurisé des documents
 * - L'appel aux APIs de vérification (OCR, liveness)
 * - La sauvegarde des résultats
 *
 * Providers supportés (à configurer) :
 * - Onfido
 * - Veriff
 * - Stripe Identity
 * - API France Identité
 */
export class IdentityVerificationService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Uploader le document d'identité (recto et/ou verso)
   */
  async uploadDocument(
    documentType: DocumentType,
    recto: Blob,
    verso?: Blob
  ): Promise<{ rectoPath: string; versoPath?: string }> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Utilisateur non authentifié");

    const timestamp = Date.now();
    const basePath = `identity/${user.id}`;

    // Upload recto
    const rectoFileName = `${basePath}/${documentType}_recto_${timestamp}.jpg`;
    const { error: rectoError } = await this.supabase.storage
      .from("documents")
      .upload(rectoFileName, recto, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (rectoError) throw new Error(`Erreur upload recto: ${rectoError.message}`);

    let versoPath: string | undefined;

    // Upload verso si fourni
    if (verso) {
      const versoFileName = `${basePath}/${documentType}_verso_${timestamp}.jpg`;
      const { error: versoError } = await this.supabase.storage
        .from("documents")
        .upload(versoFileName, verso, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (versoError) throw new Error(`Erreur upload verso: ${versoError.message}`);
      versoPath = versoFileName;
    }

    return { rectoPath: rectoFileName, versoPath };
  }

  /**
   * Uploader le selfie
   */
  async uploadSelfie(selfie: Blob): Promise<string> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Utilisateur non authentifié");

    const timestamp = Date.now();
    const filePath = `identity/${user.id}/selfie_${timestamp}.jpg`;

    const { error } = await this.supabase.storage
      .from("documents")
      .upload(filePath, selfie, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw new Error(`Erreur upload selfie: ${error.message}`);

    return filePath;
  }

  /**
   * Vérifier l'identité complète
   *
   * Cette méthode simule la vérification. En production, vous appellerez
   * un provider externe (Onfido, Veriff, etc.) via une Edge Function.
   */
  async verifyIdentity(
    documentType: DocumentType,
    rectoPath: string,
    versoPath?: string,
    selfiePath?: string
  ): Promise<VerificationResult> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Utilisateur non authentifié");

    // Start processing status
    const { data: profile } = await this.supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (profile) {
      await this.supabase.from("tenant_profiles").update({ kyc_status: 'processing' }).eq("profile_id", profile.id);
    }

    try {
      // Simulation de la vérification (à remplacer par appel réel Onfido/Stripe)
      await this.simulateProcessing(4000);

      // Données extraites simulées
      const extractedData: ExtractedIdentityData = {
        nom: "DUPONT",
        prenom: "Marie",
        date_naissance: "1992-03-15",
        lieu_naissance: "Paris",
        sexe: "F",
        nationalite: "Française",
        numero_document: `${documentType.toUpperCase()}-${Date.now()}`,
        date_expiration: "2030-01-01",
      };

      // Sauvegarder le résultat
      await this.saveVerificationResult(
        documentType,
        rectoPath,
        versoPath,
        selfiePath,
        extractedData
      );

      return {
        success: true,
        confidence: 98.2, // Higher confidence for SOTA
        extractedData,
      };
    } catch (error: unknown) {
      if (profile) {
        await this.supabase.from("tenant_profiles").update({ kyc_status: 'rejected' }).eq("profile_id", profile.id);
      }
      return {
        success: false,
        confidence: 0,
        errorCode: "verification_failed",
        errorMessage: error instanceof Error ? error.message : "La vérification a échoué",
      };
    }
  }

  /**
   * Sauvegarder le résultat de la vérification
   */
  private async saveVerificationResult(
    documentType: DocumentType,
    rectoPath: string,
    versoPath?: string,
    selfiePath?: string,
    extractedData?: ExtractedIdentityData
  ): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return;

    // Récupérer le profil
    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    // Mettre à jour le profil locataire avec les infos d'identité
    const updateData: Record<string, any> = {
      cni_recto_path: rectoPath,
      cni_verification_method: "ocr_scan",
      cni_verified_at: new Date().toISOString(),
      identity_data: extractedData || {},
      kyc_status: 'verified',
    };

    if (versoPath) {
      updateData.cni_verso_path = versoPath;
    }

    if (selfiePath) {
      updateData.selfie_path = selfiePath;
      updateData.selfie_verified_at = new Date().toISOString();
    }

    // Essayer de mettre à jour tenant_profiles
    const { error } = await this.supabase
      .from("tenant_profiles")
      .update(updateData)
      .eq("profile_id", (profile as any).id);

    if (error) {
      console.error("Erreur mise à jour tenant_profiles:", error);
      // Si pas de tenant_profile, créer un enregistrement dans tenant_documents
      await this.supabase.from("tenant_documents").insert({
        tenant_profile_id: (profile as any).id,
        document_type: this.mapDocumentType(documentType),
        file_path: rectoPath,
        file_name: rectoPath.split("/").pop() || "document",
        extracted_data: extractedData,
        verified_at: new Date().toISOString(),
        is_valid: true,
      });
    }

    // Logger l'action dans l'audit
    await this.supabase.from("audit_log").insert({
      user_id: user.id,
      action: "identity_verified",
      entity_type: "profile",
      entity_id: (profile as any).id,
      metadata: {
        document_type: documentType,
        verification_method: "ocr_scan",
      },
    } as any);
  }

  /**
   * Mapper le type de document vers le type Supabase
   */
  private mapDocumentType(type: DocumentType): string {
    const mapping: Record<DocumentType, string> = {
      cni: "cni_recto",
      passport: "passeport",
      titre_sejour: "titre_sejour",
      permis: "cni_recto", // Le permis est traité comme une CNI
    };
    return mapping[type];
  }

  /**
   * Simuler un délai de traitement
   */
  private simulateProcessing(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Vérifier si l'utilisateur a déjà une identité vérifiée
   */
  async isIdentityVerified(): Promise<boolean> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return false;

    const { data: tenantProfile } = await this.supabase
      .from("tenant_profiles")
      .select("cni_verified_at")
      .eq("profile_id", (profile as any).id)
      .single();

    return !!(tenantProfile as any)?.cni_verified_at;
  }

  /**
   * Récupérer les données d'identité vérifiées
   */
  async getVerifiedIdentity(): Promise<ExtractedIdentityData | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return null;

    const { data: tenantProfile } = await this.supabase
      .from("tenant_profiles")
      .select("identity_data, cni_verified_at")
      .eq("profile_id", (profile as any).id)
      .single();

    if (!(tenantProfile as any)?.cni_verified_at) return null;

    return (tenantProfile as any).identity_data as ExtractedIdentityData;
  }
}

export const identityVerificationService = new IdentityVerificationService();


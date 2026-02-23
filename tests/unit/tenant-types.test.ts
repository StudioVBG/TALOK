import { describe, it, expect } from "vitest";
import type {
  TenantEDLListItem,
  TenantEDLSignatureWithDetails,
  TenantEDLDetailProps,
  MeterConfig,
  TenantRoommate,
  TenantApplication,
  MarketplaceOffer,
  TenantProfileCNI,
  CNIDocument,
  TenantColocationLease,
  OnboardingProgressStep,
  PaymentMethod,
  TenantOnboardingRole,
} from "@/lib/types/tenant";

describe("Tenant Types Validation", () => {
  it("TenantEDLListItem accepte un EDL formaté valide", () => {
    const edl: TenantEDLListItem = {
      id: "edl-1",
      type: "entree",
      status: "signed",
      scheduled_at: "2026-03-01",
      created_at: "2026-02-15",
      invitation_token: "token-abc",
      property: null,
      isSigned: true,
      needsMySignature: false,
    };
    expect(edl.type).toBe("entree");
    expect(edl.isSigned).toBe(true);
  });

  it("TenantEDLListItem accepte le type sortie", () => {
    const edl: TenantEDLListItem = {
      id: "edl-2",
      type: "sortie",
      status: "draft",
      scheduled_at: null,
      created_at: "2026-02-10",
      property: null,
      isSigned: false,
      needsMySignature: true,
    };
    expect(edl.type).toBe("sortie");
    expect(edl.needsMySignature).toBe(true);
  });

  it("TenantApplication accepte une candidature valide", () => {
    const app: TenantApplication = {
      id: "app-1",
      status: "review",
      created_at: "2026-01-15",
      updated_at: "2026-01-20",
      rejection_reason: null,
      property: {
        id: "prop-1",
        adresse_complete: "12 rue de la Paix",
        ville: "Paris",
        type: "appartement",
      },
    };
    expect(app.property?.ville).toBe("Paris");
    expect(app.rejection_reason).toBeNull();
  });

  it("TenantApplication accepte une candidature rejetée", () => {
    const app: TenantApplication = {
      id: "app-2",
      status: "rejected",
      created_at: "2026-01-10",
      updated_at: "2026-01-12",
      rejection_reason: "Dossier incomplet",
      property: null,
    };
    expect(app.rejection_reason).toBe("Dossier incomplet");
  });

  it("TenantRoommate structure les données colocataire", () => {
    const roommate: TenantRoommate = {
      id: "profile-1",
      prenom: "Alice",
      nom: "Dupont",
      email: "alice@test.com",
      telephone: "0612345678",
      avatar_url: null,
      role: "colocataire",
      share_percentage: 50,
    };
    expect(roommate.share_percentage).toBe(50);
    expect(roommate.role).toBe("colocataire");
  });

  it("TenantProfileCNI accepte un profil sans CNI", () => {
    const profile: TenantProfileCNI = {
      cni_recto_path: null,
      cni_verso_path: null,
      cni_verified_at: null,
      cni_verification_method: null,
      cni_number: null,
      cni_expiry_date: null,
      identity_data: null,
      kyc_status: null,
    };
    expect(profile.kyc_status).toBeNull();
  });

  it("TenantProfileCNI accepte un profil vérifié", () => {
    const profile: TenantProfileCNI = {
      cni_recto_path: "/storage/cni/recto.jpg",
      cni_verso_path: "/storage/cni/verso.jpg",
      cni_verified_at: "2026-02-01",
      cni_verification_method: "ocr",
      cni_number: "123456789",
      cni_expiry_date: "2030-01-01",
      identity_data: { nom: "Dupont", prenom: "Jean" },
      kyc_status: "verified",
    };
    expect(profile.kyc_status).toBe("verified");
    expect(profile.cni_number).toBe("123456789");
  });

  it("OnboardingProgressStep structure un step valide", () => {
    const step: OnboardingProgressStep = { step: "identity" };
    expect(step.step).toBe("identity");
  });

  it("PaymentMethod accepte les 4 méthodes valides", () => {
    const methods: PaymentMethod[] = ["sepa_sdd", "carte_wallet", "virement_sct", "virement_inst"];
    expect(methods).toHaveLength(4);
  });

  it("TenantOnboardingRole accepte les 3 rôles valides", () => {
    const roles: TenantOnboardingRole[] = ["locataire_principal", "colocataire", "garant"];
    expect(roles).toHaveLength(3);
  });

  it("TenantColocationLease contient les données du bail coloc", () => {
    const lease: TenantColocationLease = {
      id: "lease-1",
      type_bail: "colocation",
      loyer: 800,
      charges_forfaitaires: 100,
      statut: "active",
      date_debut: "2026-01-01",
      date_fin: null,
      property: {
        id: "prop-1",
        owner_id: "owner-1",
        type: "colocation",
        adresse_complete: "12 rue Test",
        code_postal: "75001",
        ville: "Paris",
        departement: "75",
        surface: 80,
        nb_pieces: 4,
        etage: 3,
        ascenseur: true,
        energie: "C",
        ges: "B",
        unique_code: "COL123",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
    };
    expect(lease.loyer).toBe(800);
    expect(lease.property.ville).toBe("Paris");
  });

  it("CNIDocument structure un document identité", () => {
    const doc: CNIDocument = {
      id: "doc-1",
      type: "cni",
      storage_path: "/storage/cni/recto.jpg",
      expiry_date: "2030-06-15",
      verification_status: "verified",
      is_archived: false,
      created_at: "2026-01-10",
      metadata: { side: "recto" },
      lease_id: "lease-1",
    };
    expect(doc.verification_status).toBe("verified");
    expect(doc.is_archived).toBe(false);
  });
});

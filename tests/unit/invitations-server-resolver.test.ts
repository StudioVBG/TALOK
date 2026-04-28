import { describe, it, expect } from "vitest";
import { resolveInvitationByToken } from "@/lib/invitations/server-resolver";

type FakeRow = Record<string, unknown> | null;

/**
 * Mock minimal du SupabaseClient utilisé par resolveInvitationByToken :
 * - from(table).select(cols).eq(col, val).maybeSingle()
 * Le mapping `byTable` permet de simuler la présence/absence d'une ligne
 * dans chaque table (`invitations`, `guarantor_invitations`).
 */
function fakeClient(byTable: Record<string, FakeRow>) {
  return {
    from(table: string) {
      const row = byTable[table] ?? null;
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
      return builder;
    },
  } as any;
}

const inFuture = new Date(Date.now() + 86_400_000).toISOString();
const inPast = new Date(Date.now() - 86_400_000).toISOString();

describe("resolveInvitationByToken — table invitations (bail)", () => {
  it("retourne ok avec mapping FR→EN pour locataire_principal", async () => {
    const client = fakeClient({
      invitations: {
        id: "inv-1",
        email: "Tenant@Example.com",
        role: "locataire_principal",
        expires_at: inFuture,
        used_at: null,
        lease_id: "lease-42",
      },
      guarantor_invitations: null,
    });
    const result = await resolveInvitationByToken(client, "tok-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.source).toBe("lease");
      expect(result.invitation.applicativeRole).toBe("tenant");
      expect(result.invitation.invitationRole).toBe("locataire_principal");
      expect(result.invitation.email).toBe("tenant@example.com"); // normalisé
      expect(result.invitation.lease_id).toBe("lease-42");
    }
  });

  it("mappe garant → guarantor même quand la ligne est dans `invitations`", async () => {
    const client = fakeClient({
      invitations: {
        id: "inv-2",
        email: "g@x.fr",
        role: "garant",
        expires_at: inFuture,
        used_at: null,
        lease_id: null,
      },
      guarantor_invitations: null,
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.applicativeRole).toBe("guarantor");
    }
  });

  it("rejette already_used si used_at est défini", async () => {
    const client = fakeClient({
      invitations: {
        id: "inv-3",
        email: "x@x.fr",
        role: "colocataire",
        expires_at: inFuture,
        used_at: new Date().toISOString(),
        lease_id: null,
      },
      guarantor_invitations: null,
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("already_used");
  });

  it("rejette expired si expires_at est passé", async () => {
    const client = fakeClient({
      invitations: {
        id: "inv-4",
        email: "x@x.fr",
        role: "colocataire",
        expires_at: inPast,
        used_at: null,
        lease_id: null,
      },
      guarantor_invitations: null,
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("expired");
  });
});

describe("resolveInvitationByToken — fallback guarantor_invitations", () => {
  it("résout une invitation garant standalone (status pending)", async () => {
    const client = fakeClient({
      invitations: null,
      guarantor_invitations: {
        id: "gi-1",
        guarantor_email: "GUARANT@x.fr",
        status: "pending",
        expires_at: inFuture,
        accepted_at: null,
        declined_at: null,
        lease_id: "lease-99",
      },
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.source).toBe("guarantor");
      expect(result.invitation.applicativeRole).toBe("guarantor");
      expect(result.invitation.invitationRole).toBe("garant");
      expect(result.invitation.email).toBe("guarant@x.fr"); // normalisé
      expect(result.invitation.lease_id).toBe("lease-99");
    }
  });

  it("rejette already_used quand status = accepted", async () => {
    const client = fakeClient({
      invitations: null,
      guarantor_invitations: {
        id: "gi-2",
        guarantor_email: "g@x.fr",
        status: "accepted",
        expires_at: inFuture,
        accepted_at: new Date().toISOString(),
        declined_at: null,
        lease_id: null,
      },
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("already_used");
  });

  it("rejette declined quand status = declined", async () => {
    const client = fakeClient({
      invitations: null,
      guarantor_invitations: {
        id: "gi-3",
        guarantor_email: "g@x.fr",
        status: "declined",
        expires_at: inFuture,
        accepted_at: null,
        declined_at: new Date().toISOString(),
        lease_id: null,
      },
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("declined");
  });

  it("rejette expired quand status = expired ou date passée", async () => {
    const expiredByStatus = await resolveInvitationByToken(
      fakeClient({
        invitations: null,
        guarantor_invitations: {
          id: "gi-4",
          guarantor_email: "g@x.fr",
          status: "expired",
          expires_at: inFuture,
          accepted_at: null,
          declined_at: null,
          lease_id: null,
        },
      }),
      "tok"
    );
    expect(expiredByStatus.ok).toBe(false);
    if (!expiredByStatus.ok) expect(expiredByStatus.error.kind).toBe("expired");

    const expiredByDate = await resolveInvitationByToken(
      fakeClient({
        invitations: null,
        guarantor_invitations: {
          id: "gi-5",
          guarantor_email: "g@x.fr",
          status: "pending",
          expires_at: inPast,
          accepted_at: null,
          declined_at: null,
          lease_id: null,
        },
      }),
      "tok"
    );
    expect(expiredByDate.ok).toBe(false);
    if (!expiredByDate.ok) expect(expiredByDate.error.kind).toBe("expired");
  });

  it("rejette not_found si aucune table ne contient le token", async () => {
    const client = fakeClient({ invitations: null, guarantor_invitations: null });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_found");
  });
});

describe("resolveInvitationByToken — priorité d'interrogation", () => {
  it("préfère `invitations` (bail) si les deux tables contiennent le token", async () => {
    const client = fakeClient({
      invitations: {
        id: "lease-source",
        email: "x@x.fr",
        role: "locataire_principal",
        expires_at: inFuture,
        used_at: null,
        lease_id: "lease-1",
      },
      guarantor_invitations: {
        id: "garant-source",
        guarantor_email: "x@x.fr",
        status: "pending",
        expires_at: inFuture,
        accepted_at: null,
        declined_at: null,
        lease_id: "lease-2",
      },
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.source).toBe("lease");
      expect(result.invitation.id).toBe("lease-source");
    }
  });
});

describe("resolveInvitationByToken — fallback agency_invitations", () => {
  it("résout une invitation agence (status pending)", async () => {
    const client = fakeClient({
      invitations: null,
      guarantor_invitations: null,
      agency_invitations: {
        id: "ai-1",
        email: "Manager@Agency.fr",
        status: "pending",
        expires_at: inFuture,
        accepted_at: null,
        declined_at: null,
        agency_profile_id: "agency-99",
        role_agence: "gestionnaire",
        can_sign_documents: true,
      },
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.source).toBe("agency");
      expect(result.invitation.applicativeRole).toBe("agency");
      expect(result.invitation.invitationRole).toBe("agency");
      expect(result.invitation.email).toBe("manager@agency.fr");
      expect(result.invitation.agency_profile_id).toBe("agency-99");
      expect(result.invitation.agency_role).toBe("gestionnaire");
      expect(result.invitation.can_sign_documents).toBe(true);
    }
  });

  it("rejette already_used si status accepted", async () => {
    const result = await resolveInvitationByToken(
      fakeClient({
        invitations: null,
        guarantor_invitations: null,
        agency_invitations: {
          id: "ai-2",
          email: "x@x.fr",
          status: "accepted",
          expires_at: inFuture,
          accepted_at: new Date().toISOString(),
          declined_at: null,
          agency_profile_id: "agency-1",
          role_agence: "directeur",
          can_sign_documents: false,
        },
      }),
      "tok"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("already_used");
  });

  it("rejette expired si status cancelled", async () => {
    const result = await resolveInvitationByToken(
      fakeClient({
        invitations: null,
        guarantor_invitations: null,
        agency_invitations: {
          id: "ai-3",
          email: "x@x.fr",
          status: "cancelled",
          expires_at: inFuture,
          accepted_at: null,
          declined_at: null,
          agency_profile_id: "agency-1",
          role_agence: "assistant",
          can_sign_documents: false,
        },
      }),
      "tok"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("expired");
  });

  it("priorité guarantor_invitations > agency_invitations en cas de collision", async () => {
    const client = fakeClient({
      invitations: null,
      guarantor_invitations: {
        id: "gar",
        guarantor_email: "x@x.fr",
        status: "pending",
        expires_at: inFuture,
        accepted_at: null,
        declined_at: null,
        lease_id: null,
      },
      agency_invitations: {
        id: "ag",
        email: "x@x.fr",
        status: "pending",
        expires_at: inFuture,
        accepted_at: null,
        declined_at: null,
        agency_profile_id: "agency-x",
        role_agence: "comptable",
        can_sign_documents: false,
      },
    });
    const result = await resolveInvitationByToken(client, "tok");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.source).toBe("guarantor");
    }
  });
});

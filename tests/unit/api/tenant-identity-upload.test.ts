/**
 * Tests unitaires - API upload CNI identité locataire
 * POST /api/tenant/identity/upload
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const mockUser = { id: "user-1", email: "locataire@test.fr" };
const mockProfile = { id: "profile-1" };

function createMockFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

function buildFormData(overrides: {
  file?: File | null;
  side?: string;
  lease_id?: string;
  is_renewal?: string;
  ocr_data?: string;
} = {}): FormData {
  const fd = new FormData();
  fd.append("file", overrides.file ?? createMockFile("cni.jpg", 1024, "image/jpeg"));
  fd.append("side", overrides.side ?? "recto");
  fd.append("lease_id", overrides.lease_id ?? "lease-1");
  if (overrides.is_renewal !== undefined) fd.append("is_renewal", overrides.is_renewal);
  if (overrides.ocr_data !== undefined) fd.append("ocr_data", overrides.ocr_data);
  return fd;
}

const mockLeaseWithProperty = {
  id: "lease-1",
  property_id: "prop-1",
  properties: { owner_id: "owner-1" },
};
const mockNewDoc = {
  id: "doc-1",
  type: "cni_recto",
  title: "CNI Recto",
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    })
  ),
}));

const insertPayloads: Record<string, unknown>[] = [];
const mockServiceClient = {
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: "leases/lease-1/identity/cni_recto_lease-1_1.jpg" }, error: null }),
    })),
  },
};

function createChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation((payload: unknown) => {
      insertPayloads.push(payload as Record<string, unknown>);
      return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockNewDoc, error: null }) };
    }),
    update: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
}

const profilesChain = createChain();
const leaseSignersChain = createChain();
const leasesChain = createChain();
const documentsChain = createChain();
const tenantProfilesChain = createChain();

mockServiceClient.from.mockImplementation((table: string) => {
  if (table === "profiles") return profilesChain;
  if (table === "lease_signers") return leaseSignersChain;
  if (table === "leases") return leasesChain;
  if (table === "documents") return documentsChain;
  if (table === "tenant_profiles") return tenantProfilesChain;
  return createChain();
});

vi.mock("@/lib/supabase/service-client", () => ({
  getServiceClient: vi.fn(() => mockServiceClient),
}));

describe("POST /api/tenant/identity/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertPayloads.length = 0;
    profilesChain.single.mockResolvedValue({ data: mockProfile, error: null });
    leaseSignersChain.maybeSingle.mockResolvedValue({ data: { id: "signer-1", profile_id: mockProfile.id }, error: null });
    leasesChain.single.mockResolvedValue({ data: mockLeaseWithProperty, error: null });
    documentsChain.insert.mockImplementation((payload: unknown) => {
      insertPayloads.push(payload as Record<string, unknown>);
      return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockNewDoc, error: null }) };
    });
  });

  it("retourne 401 si non authentifié", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    } as any);

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/api/tenant/identity/upload", {
      method: "POST",
      body: buildFormData(),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("authentifié");
  });

  it("retourne 404 si profil non trouvé", async () => {
    profilesChain.single.mockResolvedValueOnce({ data: null, error: new Error("not found") });

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/api/tenant/identity/upload", { method: "POST", body: buildFormData() });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/Profil|trouvé/);
  });

  it("retourne 400 si fichier, côté ou lease_id manquant", async () => {
    const { POST } = await import("@/app/api/tenant/identity/upload/route");

    const noFile = new FormData();
    noFile.append("side", "recto");
    noFile.append("lease_id", "lease-1");
    const r1 = await POST(new Request("http://localhost/upload", { method: "POST", body: noFile }));
    expect(r1.status).toBe(400);

    const noSide = new FormData();
    noSide.append("file", createMockFile("cni.jpg", 1024, "image/jpeg"));
    noSide.append("lease_id", "lease-1");
    const r2 = await POST(new Request("http://localhost/upload", { method: "POST", body: noSide }));
    expect(r2.status).toBe(400);

    const noLease = new FormData();
    noLease.append("file", createMockFile("cni.jpg", 1024, "image/jpeg"));
    noLease.append("side", "recto");
    const r3 = await POST(new Request("http://localhost/upload", { method: "POST", body: noLease }));
    expect(r3.status).toBe(400);

    const json = await r1.json();
    expect(json.error).toMatch(/Fichier|requis/);
  });

  it("retourne 403 si pas signataire du bail", async () => {
    leaseSignersChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: buildFormData() });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/autorisé|bail/);
  });

  it("retourne 400 si type de fichier non autorisé", async () => {
    const fd = buildFormData({ file: createMockFile("doc.pdf", 1024, "application/pdf") });

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Type|autorisé/);
  });

  it("retourne 400 si fichier trop volumineux", async () => {
    const fd = buildFormData({
      file: createMockFile("huge.jpg", 11 * 1024 * 1024, "image/jpeg"),
    });

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/volumineux|10/);
  });

  it("retourne 400 si CNI expirée", async () => {
    const pastDate = "2020-01-01";
    const fd = buildFormData({
      ocr_data: JSON.stringify({ date_expiration: pastDate }),
    });

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/expiré|validité/);
  });

  it("retourne 200 et inclut uploaded_by dans l'insert document (recto)", async () => {
    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: buildFormData({ side: "recto" }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.document_id).toBe(mockNewDoc.id);
    expect(json.side).toBe("recto");

    expect(insertPayloads.length).toBeGreaterThanOrEqual(1);
    const docInsert = insertPayloads[0] as Record<string, unknown>;
    expect(docInsert.uploaded_by).toBe(mockProfile.id);
    expect(docInsert.tenant_id).toBe(mockProfile.id);
    expect(docInsert.type).toBe("cni_recto");
  });

  it("retourne 200 pour upload verso", async () => {
    documentsChain.insert.mockImplementationOnce((payload: unknown) => {
      insertPayloads.push(payload as Record<string, unknown>);
      return {
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { ...mockNewDoc, id: "doc-2", type: "cni_verso" }, error: null }),
      };
    });

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: buildFormData({ side: "verso" }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.side).toBe("verso");
  });

  it("docError retourne 500 et ne fait pas d'update replaced_by avec newDoc", async () => {
    documentsChain.insert.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "constraint violation", code: "23505" } }),
    }));

    const { POST } = await import("@/app/api/tenant/identity/upload/route");
    const req = new Request("http://localhost/upload", { method: "POST", body: buildFormData() });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/enregistrement|Erreur/);
    expect(documentsChain.update).not.toHaveBeenCalled();
  });
});

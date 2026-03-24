type LeaseInitialInvoiceLike = {
  id: string;
  tenant_id?: string | null;
  owner_id?: string | null;
  montant_total?: number | null;
  metadata?: Record<string, unknown> | null;
  type?: string | null;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => any;
  };
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export interface InitialInvoiceResolution {
  invoiceId: string;
  tenantProfileId: string;
  ownerProfileId: string;
  amount: number;
  depositAmount: number;
  created: boolean;
}

function parsePositiveNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

export function isInitialInvoiceRecord(invoice: {
  metadata?: Record<string, unknown> | null;
  type?: string | null;
} | null | undefined): boolean {
  if (!invoice) {
    return false;
  }

  const metadataType =
    invoice.metadata && typeof invoice.metadata.type === "string"
      ? invoice.metadata.type
      : null;

  return metadataType === "initial_invoice" || invoice.type === "initial_invoice";
}

async function findInitialInvoice(
  supabase: SupabaseLike,
  leaseId: string
): Promise<LeaseInitialInvoiceLike | null> {
  const metadataQuery = await supabase
    .from("invoices")
    .select("id, tenant_id, owner_id, montant_total, metadata, type")
    .eq("lease_id", leaseId)
    .eq("metadata->>type", "initial_invoice")
    .order("created_at", { ascending: true })
    .maybeSingle();

  if (metadataQuery.data) {
    return metadataQuery.data as LeaseInitialInvoiceLike;
  }

  const typedQuery = await supabase
    .from("invoices")
    .select("id, tenant_id, owner_id, montant_total, metadata, type")
    .eq("lease_id", leaseId)
    .eq("type", "initial_invoice")
    .order("created_at", { ascending: true })
    .maybeSingle();

  return (typedQuery.data as LeaseInitialInvoiceLike | null) ?? null;
}

function getDepositAmount(invoice: LeaseInitialInvoiceLike): number {
  const metadata = invoice.metadata ?? null;
  if (!metadata || typeof metadata !== "object") {
    return 0;
  }

  return parsePositiveNumber(metadata.deposit_amount);
}

const TENANT_ROLE_VARIANTS = new Set([
  "locataire_principal",
  "locataire",
  "tenant",
  "principal",
  "colocataire",
  "co_locataire",
  "cotenant",
]);

const OWNER_ROLE_VARIANTS = new Set([
  "proprietaire",
  "owner",
  "bailleur",
]);

function isTenantLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return TENANT_ROLE_VARIANTS.has(role.toLowerCase().trim());
}

function isOwnerLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return OWNER_ROLE_VARIANTS.has(role.toLowerCase().trim());
}

async function resolveTenantProfileId(
  supabase: SupabaseLike,
  signers: Array<{ profile_id?: string | null; role?: string | null; invited_email?: string | null }>
): Promise<string | null> {
  // 1. Direct match: signer with profile_id and a tenant role
  const directMatch = signers.find(
    (signer) =>
      Boolean(signer.profile_id) &&
      isTenantLikeRole(signer.role)
  );

  if (directMatch?.profile_id) {
    return directMatch.profile_id;
  }

  // 2. Invited signer with tenant role → lookup profile by email
  const invitedSigner = signers.find(
    (signer) =>
      Boolean(signer.invited_email) &&
      isTenantLikeRole(signer.role)
  );

  if (invitedSigner?.invited_email) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", invitedSigner.invited_email)
      .maybeSingle();

    if ((profile as { id?: string } | null)?.id) {
      return (profile as { id: string }).id;
    }
  }

  // 3. Fallback: any signer with profile_id who is NOT an owner
  const nonOwnerWithProfile = signers.find(
    (signer) =>
      Boolean(signer.profile_id) &&
      !isOwnerLikeRole(signer.role)
  );

  if (nonOwnerWithProfile?.profile_id) {
    console.warn(
      "[initial-invoice] Fallback: using non-owner signer as tenant:",
      nonOwnerWithProfile.profile_id,
      "role:", nonOwnerWithProfile.role
    );
    return nonOwnerWithProfile.profile_id;
  }

  // 4. Last resort: any invited email that's not an owner → lookup
  const anyInvited = signers.find(
    (signer) =>
      Boolean(signer.invited_email) &&
      !isOwnerLikeRole(signer.role)
  );

  if (anyInvited?.invited_email) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", anyInvited.invited_email)
      .maybeSingle();

    if ((profile as { id?: string } | null)?.id) {
      console.warn(
        "[initial-invoice] Fallback: resolved tenant from invited email:",
        anyInvited.invited_email
      );
      return (profile as { id: string }).id;
    }
  }

  console.error(
    "[initial-invoice] Cannot resolve tenant profile_id. Signers:",
    JSON.stringify(signers.map(s => ({ role: s.role, has_profile: !!s.profile_id, has_email: !!s.invited_email })))
  );
  return null;
}

export async function ensureInitialInvoiceForLease(
  supabase: SupabaseLike,
  leaseId: string
): Promise<InitialInvoiceResolution> {
  const existingInvoice = await findInitialInvoice(supabase, leaseId);

  if (existingInvoice?.id && existingInvoice.tenant_id && existingInvoice.owner_id) {
    return {
      invoiceId: existingInvoice.id,
      tenantProfileId: existingInvoice.tenant_id,
      ownerProfileId: existingInvoice.owner_id,
      amount: Number(existingInvoice.montant_total ?? 0),
      depositAmount: getDepositAmount(existingInvoice),
      created: false,
    };
  }

  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id,
      property:properties!leases_property_id_fkey (owner_id),
      signers:lease_signers(profile_id, role, invited_email)
    `)
    .eq("id", leaseId)
    .single();

  const leaseData = lease as
    | {
        property?: { owner_id?: string | null } | null;
        signers?: Array<{
          profile_id?: string | null;
          role?: string | null;
          invited_email?: string | null;
        }> | null;
      }
    | null;

  const ownerProfileId = leaseData?.property?.owner_id ?? null;
  const tenantProfileId = await resolveTenantProfileId(
    supabase,
    leaseData?.signers ?? []
  );

  if (!ownerProfileId || !tenantProfileId) {
    throw new Error(
      "Impossible de générer la facture initiale: propriétaire ou locataire principal introuvable."
    );
  }

  const { error } = await supabase.rpc("generate_initial_signing_invoice", {
    p_lease_id: leaseId,
    p_tenant_id: tenantProfileId,
    p_owner_id: ownerProfileId,
  });

  if (error) {
    throw new Error(`Erreur génération facture initiale: ${error.message}`);
  }

  const generatedInvoice = await findInitialInvoice(supabase, leaseId);

  if (!generatedInvoice?.id) {
    throw new Error(
      "La facture initiale n'a pas été retrouvée après sa génération."
    );
  }

  return {
    invoiceId: generatedInvoice.id,
    tenantProfileId,
    ownerProfileId,
    amount: Number(generatedInvoice.montant_total ?? 0),
    depositAmount: getDepositAmount(generatedInvoice),
    created: true,
  };
}

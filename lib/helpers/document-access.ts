/**
 * Shared document access check helpers for API routes
 * Used by /api/documents/view, /download, /file to verify permissions
 */

type ServiceClient = {
  from: (table: string) => any;
};

interface ProfileInfo {
  id: string;
  role: string;
}

/**
 * Check if a user has access to a document based on storage path.
 * Handles lease paths, EDL paths, and falls back to document table lookup.
 */
export async function checkStoragePathAccess(
  serviceClient: ServiceClient,
  storagePath: string,
  profile: ProfileInfo
): Promise<boolean> {
  const pathParts = storagePath.split("/");
  const isAdmin = profile.role === "admin";
  if (isAdmin) return true;

  // Lease-related paths: leases/{leaseId}/... or bails/{leaseId}/...
  if ((pathParts[0] === "leases" || pathParts[0] === "bails") && pathParts[1]) {
    return checkLeaseAccess(serviceClient, pathParts[1], profile);
  }

  // EDL-related paths: edl/{edlId}/...
  if (pathParts[0] === "edl" && pathParts[1]) {
    return checkEdlAccess(serviceClient, pathParts[1], profile);
  }

  // Quittances: quittances/{leaseId}/...
  if (pathParts[0] === "quittances" && pathParts[1]) {
    return checkLeaseAccess(serviceClient, pathParts[1], profile);
  }

  // Key-handover: key-handover/{leaseId}/...
  if (pathParts[0] === "key-handover" && pathParts[1]) {
    return checkLeaseAccess(serviceClient, pathParts[1], profile);
  }

  // For all other paths (documents/*, properties/*, etc.):
  // Look up the document record in the table and check ownership
  return checkDocumentTableAccess(serviceClient, storagePath, profile);
}

async function checkLeaseAccess(
  serviceClient: ServiceClient,
  leaseId: string,
  profile: ProfileInfo
): Promise<boolean> {
  const { data: lease } = await serviceClient
    .from("leases")
    .select("id, property:properties!leases_property_id_fkey(owner_id), signers:lease_signers(profile_id)")
    .eq("id", leaseId)
    .single();

  if (!lease) return false;

  const isOwner = (lease as any).property?.owner_id === profile.id;
  const isSigner = (lease as any).signers?.some((s: any) => s.profile_id === profile.id);
  return isOwner || isSigner;
}

async function checkEdlAccess(
  serviceClient: ServiceClient,
  edlId: string,
  profile: ProfileInfo
): Promise<boolean> {
  const { data: edlRecord } = await serviceClient
    .from("edl")
    .select("id, lease_id, property_id, created_by, edl_signatures(signer_profile_id)")
    .eq("id", edlId)
    .single();

  if (!edlRecord) return false;

  const isCreator = (edlRecord as any).created_by === profile.id;
  const isEdlSigner = (edlRecord as any).edl_signatures?.some(
    (s: any) => s.signer_profile_id === profile.id
  );

  if (isCreator || isEdlSigner) return true;

  // Check via associated lease
  if ((edlRecord as any).lease_id) {
    return checkLeaseAccess(serviceClient, (edlRecord as any).lease_id, profile);
  }

  return false;
}

async function checkDocumentTableAccess(
  serviceClient: ServiceClient,
  storagePath: string,
  profile: ProfileInfo
): Promise<boolean> {
  // Look up the document record by storage_path
  const { data: doc } = await serviceClient
    .from("documents")
    .select("id, owner_id, tenant_id, property_id, lease_id, visible_tenant")
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (!doc) {
    // No document record found — deny access by default
    return false;
  }

  const docData = doc as any;

  // Owner of the document
  if (docData.owner_id === profile.id) return true;

  // Tenant of the document (only if visible_tenant is true)
  if (docData.tenant_id === profile.id) {
    return docData.visible_tenant !== false;
  }

  // Check via property ownership
  if (docData.property_id) {
    const { data: property } = await serviceClient
      .from("properties")
      .select("id")
      .eq("id", docData.property_id)
      .eq("owner_id", profile.id)
      .maybeSingle();
    if (property) return true;
  }

  // Check via lease signer
  if (docData.lease_id) {
    const { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id, role")
      .eq("lease_id", docData.lease_id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (signer) {
      const isTenantRole = ["locataire_principal", "locataire", "colocataire"].includes(
        (signer as any).role
      );
      // Tenants can only access if visible_tenant = true
      if (isTenantRole) {
        return docData.visible_tenant !== false;
      }
      return true;
    }
  }

  // Provider check via work orders
  if (profile.role === "provider" && docData.property_id) {
    const { data: workOrder } = await serviceClient
      .from("work_orders")
      .select("id, tickets!inner(property_id)")
      .eq("provider_id", profile.id)
      .eq("tickets.property_id", docData.property_id)
      .limit(1);
    return !!(workOrder && workOrder.length > 0);
  }

  return false;
}

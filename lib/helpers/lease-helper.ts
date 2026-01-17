/**
 * Helper functions for lease management
 * Used to check active leases and validate lease-related operations
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Check if a property has an active lease
 * A lease is considered active if:
 * - statut = 'active'
 * - date_debut <= now()
 * - date_fin IS NULL OR date_fin >= now()
 */
export async function hasActiveLeaseForProperty(
  propertyId: string,
  supabaseUrl?: string,
  serviceRoleKey?: string
): Promise<{ hasActive: boolean; lease?: any; error?: string }> {
  try {
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return {
        hasActive: false,
        error: "Supabase configuration missing",
      };
    }

    const serviceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Query for active leases
    const { data: activeLeases, error } = await serviceClient
      .from("leases")
      .select("id, property_id, date_debut, date_fin, statut, type_bail")
      .eq("property_id", propertyId)
      .eq("statut", "active")
      .lte("date_debut", new Date().toISOString().split("T")[0])
      .or(`date_fin.is.null,date_fin.gte.${new Date().toISOString().split("T")[0]}`)
      .limit(1);

    if (error) {
      console.error("[hasActiveLeaseForProperty] Error checking leases:", error);
      return {
        hasActive: false,
        error: error.message,
      };
    }

    const hasActive = activeLeases && activeLeases.length > 0;

    return {
      hasActive,
      lease: hasActive ? activeLeases[0] : undefined,
    };
  } catch (error: unknown) {
    console.error("[hasActiveLeaseForProperty] Exception:", error);
    return {
      hasActive: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get active lease details with tenant information
 */
export async function getActiveLeaseWithTenant(
  propertyId: string,
  supabaseUrl?: string,
  serviceRoleKey?: string
): Promise<{ lease?: any; tenant?: any; error?: string }> {
  try {
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return {
        error: "Supabase configuration missing",
      };
    }

    const serviceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get active lease
    const { data: activeLeases, error: leaseError } = await serviceClient
      .from("leases")
      .select("id, property_id, date_debut, date_fin, statut, type_bail")
      .eq("property_id", propertyId)
      .eq("statut", "active")
      .lte("date_debut", new Date().toISOString().split("T")[0])
      .or(`date_fin.is.null,date_fin.gte.${new Date().toISOString().split("T")[0]}`)
      .limit(1);

    if (leaseError || !activeLeases || activeLeases.length === 0) {
      return {
        error: leaseError?.message || "No active lease found",
      };
    }

    const lease = activeLeases[0];

    // Get tenant information from lease_signers
    const { data: signers, error: signersError } = await serviceClient
      .from("lease_signers")
      .select("profile_id, role")
      .eq("lease_id", lease.id)
      .in("role", ["locataire_principal", "colocataire"])
      .limit(1);

    if (signersError) {
      return {
        lease,
        error: signersError.message,
      };
    }

    if (!signers || signers.length === 0) {
      return {
        lease,
      };
    }

    // Get profile information
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, email")
      .eq("id", signers[0].profile_id)
      .single();

    if (profileError) {
      return {
        lease,
        error: profileError.message,
      };
    }

    return {
      lease,
      tenant: profile,
    };
  } catch (error: unknown) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}


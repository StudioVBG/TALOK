import { createClient } from "@/lib/supabase/server";

// Interface pour un bail avec propriété jointe
export interface TenantLease {
  id: string;
  property_id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin?: string;
  statut: string;
  created_at: string;
  lease_signers: Array<{
    id: string;
    profile_id: string;
    role: string;
    signature_status: string;
    signed_at?: string;
    prenom: string;
    nom: string;
    avatar_url?: string;
  }>;
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    surface?: number;
    nb_pieces?: number;
    etage?: number;
    ascenseur?: boolean;
    annee_construction?: number;
    parking_numero?: string;
    cave_numero?: string;
    num_lot?: string;
    digicode?: string;
    interphone?: string;
    dpe_classe_energie?: string;
    dpe_classe_climat?: string;
    cover_url?: string;
    meters?: Array<{
      id: string;
      type: string;
      serial_number: string;
      unit: string;
      last_reading_value?: number;
      last_reading_date?: string;
    }>;
    keys?: Array<{
      label: string;
      count_info: string;
    }>;
  };
  owner: {
    id: string;
    name: string;
    email?: string;
  };
}

// Interface pour une facture avec info propriété
export interface TenantInvoice {
  id: string;
  lease_id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: string;
  due_date?: string;
  property_type: string;
  property_address: string;
}

// Interface pour un ticket avec info propriété
export interface TenantTicket {
  id: string;
  titre: string;
  description?: string;
  priorite: string;
  statut: string;
  created_at: string;
  property_id: string;
  property_address: string;
  property_type: string;
}

export interface PendingEDL {
  id: string;
  type: "entree" | "sortie";
  scheduled_at: string;
  invitation_token: string;
  property_address: string;
  property_type: string;
}

export interface TenantDashboardData {
  profile_id: string;
  kyc_status: 'pending' | 'processing' | 'verified' | 'rejected';
  tenant?: {
    prenom: string;
    nom: string;
  };
  // NOUVEAU : Support multi-baux
  leases: TenantLease[];
  properties: any[];
  // RÉTRO-COMPATIBILITÉ : Premier bail/propriété
  lease: TenantLease | null;
  property: any | null;
  // Données communes
  invoices: TenantInvoice[];
  tickets: TenantTicket[];
  notifications: any[];
  pending_edls: PendingEDL[];
  insurance: {
    has_insurance: boolean;
    last_expiry_date?: string;
  };
  stats: {
    unpaid_amount: number;
    unpaid_count: number;
    total_monthly_rent: number;
    active_leases_count: number;
  };
}

/**
 * Fallback : requêtes directes quand la RPC tenant_dashboard n'est pas disponible
 */
async function fetchTenantDashboardFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  profileId: string
): Promise<TenantDashboardData> {
  // Profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom, kyc_status")
    .eq("user_id", userId)
    .single();

  // Trouver les baux via lease_signers (par profile_id)
  const { data: signerRows } = await supabase
    .from("lease_signers")
    .select("lease_id, role, signature_status, signed_at")
    .eq("profile_id", profileId);

  const leaseIds = signerRows?.map((s) => s.lease_id) || [];

  let leases: TenantLease[] = [];
  let invoices: TenantInvoice[] = [];
  let tickets: TenantTicket[] = [];

  if (leaseIds.length > 0) {
    // Baux avec propriétés
    const { data: leaseRows } = await supabase
      .from("leases")
      .select(`
        id, type_bail, loyer, charges_forfaitaires, depot_de_garantie,
        date_debut, date_fin, statut, created_at, property_id,
        properties:property_id (
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces,
          etage, ascenseur, annee_construction, parking_numero, cave_numero,
          num_lot, digicode, interphone, dpe_classe_energie, dpe_classe_climat, cover_url
        )
      `)
      .in("id", leaseIds)
      .in("statut", ["active", "pending_signature", "fully_signed"]);

    if (leaseRows) {
      const propertyIds = leaseRows.map((l: any) => l.property_id).filter(Boolean);

      // Propriétaire de chaque propriété
      let ownerMap: Record<string, { id: string; name: string; email?: string }> = {};
      if (propertyIds.length > 0) {
        const { data: props } = await supabase
          .from("properties")
          .select("id, owner_id, profiles:owner_id (id, prenom, nom, email)")
          .in("id", propertyIds);
        if (props) {
          for (const p of props as any[]) {
            if (p.profiles) {
              ownerMap[p.id] = {
                id: p.profiles.id,
                name: `${p.profiles.prenom || ""} ${p.profiles.nom || ""}`.trim() || "Propriétaire",
                email: p.profiles.email,
              };
            }
          }
        }
      }

      // Signataires par bail
      const { data: allSigners } = await supabase
        .from("lease_signers")
        .select("id, lease_id, profile_id, role, signature_status, signed_at, profiles:profile_id (prenom, nom, avatar_url)")
        .in("lease_id", leaseIds);

      const signersByLease: Record<string, any[]> = {};
      if (allSigners) {
        for (const s of allSigners as any[]) {
          if (!signersByLease[s.lease_id]) signersByLease[s.lease_id] = [];
          signersByLease[s.lease_id].push({
            id: s.id,
            profile_id: s.profile_id,
            role: s.role,
            signature_status: s.signature_status,
            signed_at: s.signed_at,
            prenom: s.profiles?.prenom || "",
            nom: s.profiles?.nom || "",
            avatar_url: s.profiles?.avatar_url,
          });
        }
      }

      leases = leaseRows.map((l: any) => ({
        id: l.id,
        property_id: l.property_id,
        type_bail: l.type_bail,
        loyer: l.loyer,
        charges_forfaitaires: l.charges_forfaitaires,
        depot_de_garantie: l.depot_de_garantie,
        date_debut: l.date_debut,
        date_fin: l.date_fin,
        statut: l.statut,
        created_at: l.created_at,
        lease_signers: signersByLease[l.id] || [],
        property: l.properties ? {
          ...l.properties,
          ville: l.properties.ville || "Ville inconnue",
          code_postal: l.properties.code_postal || "00000",
          adresse_complete: l.properties.adresse_complete || "Adresse non renseignée",
          meters: [],
          keys: [],
        } : null,
        owner: ownerMap[l.property_id] || { id: "", name: "Propriétaire" },
      }));
    }

    // Factures liées aux baux
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id, lease_id, periode, montant_total, montant_loyer, montant_charges, statut, due_date")
      .in("lease_id", leaseIds)
      .order("created_at", { ascending: false })
      .limit(10);

    if (invoiceRows) {
      invoices = invoiceRows.map((inv: any) => {
        const lease = leases.find((l) => l.id === inv.lease_id);
        return {
          id: inv.id,
          lease_id: inv.lease_id,
          periode: inv.periode,
          montant_total: inv.montant_total,
          montant_loyer: inv.montant_loyer,
          montant_charges: inv.montant_charges,
          statut: inv.statut,
          due_date: inv.due_date,
          property_type: lease?.property?.type || "",
          property_address: lease?.property?.adresse_complete || "",
        };
      });
    }

    // Tickets liés aux propriétés des baux
    const ticketPropertyIds = leases.map((l) => l.property_id).filter(Boolean);
    if (ticketPropertyIds.length > 0) {
      const { data: ticketRows } = await supabase
        .from("tickets")
        .select("id, titre, description, priorite, statut, created_at, property_id")
        .in("property_id", ticketPropertyIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (ticketRows) {
        tickets = ticketRows.map((t: any) => {
          const lease = leases.find((l) => l.property_id === t.property_id);
          return {
            id: t.id,
            titre: t.titre,
            description: t.description,
            priorite: t.priorite,
            statut: t.statut,
            created_at: t.created_at,
            property_id: t.property_id,
            property_address: lease?.property?.adresse_complete || "",
            property_type: lease?.property?.type || "",
          };
        });
      }
    }
  }

  // Stats
  const unpaidInvoices = invoices.filter((i) => i.statut === "sent" || i.statut === "late");
  const activeLeases = leases.filter((l) => l.statut === "active");

  return {
    profile_id: profileId,
    kyc_status: (profile?.kyc_status as any) || "pending",
    tenant: profile ? { prenom: profile.prenom, nom: profile.nom } : undefined,
    leases,
    properties: leases.map((l) => l.property).filter(Boolean),
    lease: leases.length > 0 ? leases[0] : null,
    property: leases.length > 0 ? leases[0].property : null,
    invoices,
    tickets,
    notifications: [],
    pending_edls: [],
    insurance: { has_insurance: false },
    stats: {
      unpaid_amount: unpaidInvoices.reduce((sum, i) => sum + (i.montant_total || 0), 0),
      unpaid_count: unpaidInvoices.length,
      total_monthly_rent: activeLeases.reduce((sum, l) => sum + (l.loyer || 0) + (l.charges_forfaitaires || 0), 0),
      active_leases_count: activeLeases.length,
    },
  };
}

export async function fetchTenantDashboard(userId: string): Promise<TenantDashboardData | null> {
  const supabase = await createClient();

  // On passe directement le user_id à la RPC qui est sécurisée (SECURITY DEFINER)
  // mais on vérifie quand même que c'est bien le user connecté
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.id !== userId) {
    throw new Error("Accès non autorisé");
  }

  // Récupérer le profile_id (nécessaire pour le fallback)
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, prenom, nom, kyc_status")
    .eq("user_id", userId)
    .single();

  // 1. Tenter la RPC tenant_dashboard
  const { data, error } = await supabase.rpc("tenant_dashboard", {
    p_tenant_user_id: userId,
  });

  if (error) {
    console.error("[fetchTenantDashboard] RPC Error, fallback sur requêtes directes:", error.message);
    if (!profileRow) return null;
    return fetchTenantDashboardFallback(supabase, userId, profileRow.id);
  }

  if (!data) return null;

  // Nettoyage des données pour éviter les "undefined" et assurer la cohérence
  const cleanData = data as any;
  cleanData.tenant = profileRow ? { prenom: profileRow.prenom, nom: profileRow.nom } : undefined;

  if (cleanData.leases) {
    cleanData.leases = cleanData.leases.map((l: any) => ({
      ...l,
      property: l.property ? {
        ...l.property,
        ville: l.property.ville || "Ville inconnue",
        code_postal: l.property.code_postal || "00000",
        adresse_complete: l.property.adresse_complete || "Adresse non renseignée"
      } : l.property,
      owner: l.owner ? {
        ...l.owner,
        name: l.owner.name && !l.owner.name.includes('undefined') ? l.owner.name : "Propriétaire"
      } : l.owner
    }));

    // Mettre à jour les raccourcis
    if (cleanData.leases.length > 0) {
      cleanData.lease = cleanData.leases[0];
      cleanData.property = cleanData.leases[0].property;
    }
  }

  return cleanData;
}


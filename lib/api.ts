/**
 * Client API central - Single source of truth pour tous les appels API
 */

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    credentials: "include", // Inclure les cookies pour l'authentification
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(errorText || `HTTP ${r.status}`);
  }

  return r.json();
}

export const PropertyAPI = {
  createDraft: (body: {
    kind: string;
    address: { line1: string; city: string; postal_code: string; country_code: string };
    status?: string;
  }) => {
    // Mapping kind vers type_bien
    const typeMapping: Record<string, string> = {
      APARTMENT: "appartement",
      HOUSE: "maison",
      STUDIO: "studio",
      COLOCATION: "colocation",
      PARKING: "parking",
      BOX: "box",
      RETAIL: "local_commercial",
      OFFICE: "bureaux",
      WAREHOUSE: "entrepot",
      MIXED: "fonds_de_commerce",
    };
    
    const type_bien = typeMapping[body.kind] || body.kind.toLowerCase();
    const usage_principal = ["PARKING", "BOX", "RETAIL", "OFFICE", "WAREHOUSE", "MIXED"].includes(body.kind)
      ? "local_commercial"
      : "habitation";
    
    return api<{ property_id: string; unit_id: string; property?: any }>("/api/properties", {
      method: "POST",
      body: JSON.stringify({
        type_bien,
        usage_principal,
      }),
    });
  },

  activate: (id: string) =>
    api(`/api/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ACTIVE" }),
    }),
};

export const UnitAPI = {
  patch: (id: string, body: any) =>
    api(`/api/units/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  createCode: (id: string) =>
    api<{ code: string }>(`/api/units/${id}/code`, {
      method: "POST",
    }),
};


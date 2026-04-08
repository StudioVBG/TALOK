/**
 * API Route: Bank Institutions
 * GET /api/accounting/bank/institutions
 *
 * Returns a list of supported bank institutions for the connect flow.
 * Cached for 24 hours. Includes Antilles-specific banks.
 */

import { NextResponse } from "next/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ── Antilles banks (not always in Nordigen) ────────────────────────

const ANTILLES_BANKS = [
  {
    id: "bred_antilles",
    name: "BRED Banque Populaire",
    bic: "BREDFRPP",
    logo: "/images/banks/bred.png",
    countries: ["FR", "GP", "MQ", "GF", "RE"],
  },
  {
    id: "bnp_antilles",
    name: "BNP Paribas Antilles-Guyane",
    bic: "BNPAFRPP",
    logo: "/images/banks/bnp.png",
    countries: ["GP", "MQ", "GF"],
  },
  {
    id: "ca_martinique",
    name: "Credit Agricole Martinique-Guyane",
    bic: "AGRIMQMX",
    logo: "/images/banks/ca.png",
    countries: ["MQ", "GF"],
  },
  {
    id: "ca_guadeloupe",
    name: "Credit Agricole Guadeloupe",
    bic: "AGRIGPMX",
    logo: "/images/banks/ca.png",
    countries: ["GP"],
  },
  {
    id: "bfc_antilles",
    name: "Banque Francaise Commerciale Antilles-Guyane",
    bic: "BFCOFRPP",
    logo: "/images/banks/bfc.png",
    countries: ["GP", "MQ", "GF"],
  },
];

// ── Cache ──────────────────────────────────────────────────────────

let cachedInstitutions: Institution[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
}

// ── Handler ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const now = Date.now();

    // Return cached if still valid
    if (cachedInstitutions && now - cacheTimestamp < CACHE_DURATION_MS) {
      return NextResponse.json({
        success: true,
        data: { institutions: cachedInstitutions },
      });
    }

    // Try to fetch from Nordigen / GoCardless
    let nordigenInstitutions: Institution[] = [];

    try {
      const nordigenToken = process.env.NORDIGEN_SECRET_KEY;
      const nordigenId = process.env.NORDIGEN_SECRET_ID;

      if (nordigenToken && nordigenId) {
        // Get access token
        const tokenRes = await fetch(
          "https://bankaccountdata.gocardless.com/api/v2/token/new/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret_id: nordigenId,
              secret_key: nordigenToken,
            }),
          }
        );

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();

          // Fetch FR institutions
          const instRes = await fetch(
            "https://bankaccountdata.gocardless.com/api/v2/institutions/?country=fr",
            {
              headers: {
                Authorization: `Bearer ${tokenData.access}`,
              },
            }
          );

          if (instRes.ok) {
            const instData = await instRes.json();
            nordigenInstitutions = (instData || []).map(
              (inst: {
                id: string;
                name: string;
                bic: string;
                logo: string;
                countries: string[];
              }) => ({
                id: inst.id,
                name: inst.name,
                bic: inst.bic || "",
                logo: inst.logo || "",
                countries: inst.countries || ["FR"],
              })
            );
          }
        }
      }
    } catch {
      // Nordigen not configured or error — continue with fallback
      console.warn("[institutions] Nordigen fetch failed, using fallback list");
    }

    // Merge with Antilles banks (deduplicate by BIC)
    const existingBics = new Set(
      nordigenInstitutions.map((i) => i.bic.toUpperCase())
    );
    const mergedInstitutions = [
      ...nordigenInstitutions,
      ...ANTILLES_BANKS.filter(
        (b) => !existingBics.has(b.bic.toUpperCase())
      ),
    ];

    // Sort alphabetically
    mergedInstitutions.sort((a, b) => a.name.localeCompare(b.name, "fr"));

    // Cache the result
    cachedInstitutions = mergedInstitutions;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      data: { institutions: mergedInstitutions },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

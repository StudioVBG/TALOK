/**
 * Helpers partagés pour les routes CRON copropriété (S3-1).
 *
 * - `assertCronAuth` : vérifie le bearer token `CRON_SECRET`
 * - `loadSyndicInfoForSite` : charge le site + le syndic_profile complet
 *   pour alimenter la signature des emails
 * - `findCoproprietairesForSite` : retourne la liste des destinataires
 *   pour un site (via user_site_roles + profiles)
 * - `formatPeriodLabel` : format "janvier 2026" depuis un entier mois+année
 */

import { NextResponse } from "next/server";
import type { SyndicInfo, CoproSiteInfo } from "@/lib/emails/templates/copro-shared";

/**
 * Vérifie le header Authorization Bearer contre CRON_SECRET.
 * Retourne une NextResponse 401 si invalide, null si OK.
 */
export function assertCronAuth(request: Request): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return null;
}

/**
 * Charge les informations du syndic propriétaire d'un site, formatées
 * pour `SyndicInfo` (signature email).
 */
export async function loadSyndicInfoForSite(
  supabase: any,
  siteId: string
): Promise<{ site: CoproSiteInfo | null; syndic: SyndicInfo | null }> {
  // 1. Charger le site
  const { data: site } = await supabase
    .from("sites")
    .select(`
      id,
      name,
      address_line1,
      postal_code,
      city,
      syndic_profile_id
    `)
    .eq("id", siteId)
    .maybeSingle();

  if (!site) {
    return { site: null, syndic: null };
  }

  const siteInfo: CoproSiteInfo = {
    name: (site as any).name,
    address: `${(site as any).address_line1 ?? ""}, ${(site as any).postal_code ?? ""} ${
      (site as any).city ?? ""
    }`
      .trim()
      .replace(/^,\s*/, "")
      .replace(/\s+,/g, ",") || null,
  };

  const syndicProfileId = (site as any).syndic_profile_id;
  if (!syndicProfileId) {
    return { site: siteInfo, syndic: null };
  }

  // 2. Charger le profil syndic (table syndic_profiles + profiles pour prenom/nom)
  const { data: syndicProfile } = await supabase
    .from("syndic_profiles")
    .select(`
      raison_sociale,
      type_syndic,
      numero_carte_pro,
      email_contact,
      telephone,
      adresse_siege,
      code_postal,
      ville
    `)
    .eq("profile_id", syndicProfileId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom, email, telephone")
    .eq("id", syndicProfileId)
    .maybeSingle();

  const displayName =
    (syndicProfile as any)?.raison_sociale ||
    `${(profile as any)?.prenom ?? ""} ${(profile as any)?.nom ?? ""}`.trim() ||
    "Syndic";

  const syndicAddress = (syndicProfile as any)?.adresse_siege
    ? `${(syndicProfile as any).adresse_siege}, ${
        (syndicProfile as any).code_postal ?? ""
      } ${(syndicProfile as any).ville ?? ""}`.trim()
    : null;

  const syndicInfo: SyndicInfo = {
    displayName,
    typeSyndic: ((syndicProfile as any)?.type_syndic ?? "benevole") as
      | "professionnel"
      | "benevole"
      | "cooperatif",
    numeroCartePro: (syndicProfile as any)?.numero_carte_pro ?? null,
    emailContact:
      (syndicProfile as any)?.email_contact ?? (profile as any)?.email ?? null,
    telephone:
      (syndicProfile as any)?.telephone ?? (profile as any)?.telephone ?? null,
    adresse: syndicAddress,
  };

  return { site: siteInfo, syndic: syndicInfo };
}

/**
 * Charge tous les copropriétaires d'un site depuis user_site_roles
 * avec leurs emails via profiles.
 */
export async function findCoproprietairesForSite(
  supabase: any,
  siteId: string
): Promise<
  Array<{
    userId: string;
    profileId: string;
    email: string;
    displayName: string;
  }>
> {
  const { data: roles } = await supabase
    .from("user_site_roles")
    .select("user_id, role_code")
    .eq("site_id", siteId)
    .in("role_code", [
      "coproprietaire",
      "coproprietaire_bailleur",
      "coproprietaire_occupant",
    ]);

  if (!roles || roles.length === 0) return [];

  const userIds = (roles as any[]).map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, prenom, nom, email")
    .in("user_id", userIds);

  if (!profiles) return [];

  return (profiles as any[])
    .filter((p) => p.email)
    .map((p) => ({
      userId: p.user_id,
      profileId: p.id,
      email: p.email,
      displayName: `${p.prenom ?? ""} ${p.nom ?? ""}`.trim() || "Copropriétaire",
    }));
}

/**
 * Format "janvier 2026" depuis une date.
 */
export function formatPeriodLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Calcule le nombre de jours écoulés entre deux dates (entier).
 * Toujours positif si `from` est antérieur à `to`.
 */
export function daysBetween(from: Date | string, to: Date | string): number {
  const fromDate = typeof from === "string" ? new Date(from) : from;
  const toDate = typeof to === "string" ? new Date(to) : to;
  return Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

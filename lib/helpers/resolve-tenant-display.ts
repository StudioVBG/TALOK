/**
 * SOTA 2026 — Résolution centralisée des données d'affichage locataire
 *
 * Une seule source de vérité pour : profile → invited_name → invited_email → placeholder.
 * Utilisé partout où on affiche le nom/email du locataire (sidebar bail, PDF, liste, EDL).
 */

export interface TenantDisplay {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  adresse: string;
  /** true si profile_id est lié */
  isLinked: boolean;
  /** true si aucune donnée réelle (placeholder) */
  isPlaceholder: boolean;
}

export interface SignerLike {
  profile?: {
    prenom?: string | null;
    nom?: string | null;
    email?: string | null;
    telephone?: string | null;
    date_naissance?: string | null;
    lieu_naissance?: string | null;
    nationalite?: string | null;
    adresse?: string | null;
  } | null;
  invited_name?: string | null;
  invited_email?: string | null;
}

const PLACEHOLDER_EMAIL_PATTERNS = ["@a-definir", "a-definir.com", "placeholder"];

function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return true;
  const lower = email.toLowerCase();
  return PLACEHOLDER_EMAIL_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Résout les données d'affichage d'un signataire locataire (cascade profile → invited_name → invited_email → placeholder).
 */
export function resolveTenantDisplay(signer: SignerLike | null | undefined): TenantDisplay {
  const empty: TenantDisplay = {
    prenom: "",
    nom: "[En attente de locataire]",
    email: "",
    telephone: "",
    dateNaissance: "",
    lieuNaissance: "",
    nationalite: "Française",
    adresse: "",
    isLinked: false,
    isPlaceholder: true,
  };

  if (!signer) return empty;

  const profile = signer.profile;
  const hasProfileName = !!(profile?.prenom || profile?.nom);

  // 1. Profil lié avec nom/prénom
  if (hasProfileName) {
    return {
      prenom: profile!.prenom ?? "",
      nom: profile!.nom ?? "",
      email: profile!.email ?? signer.invited_email ?? "",
      telephone: profile!.telephone ?? "",
      dateNaissance: profile!.date_naissance ?? "",
      lieuNaissance: profile!.lieu_naissance ?? "",
      nationalite: profile!.nationalite ?? "Française",
      adresse: profile!.adresse ?? "",
      isLinked: true,
      isPlaceholder: false,
    };
  }

  // 2. Nom d'invitation
  if (signer.invited_name?.trim()) {
    const parts = signer.invited_name.trim().split(/\s+/);
    const prenom = parts[0] ?? "";
    const nom = parts.slice(1).join(" ") ?? "";
    return {
      prenom,
      nom: nom || prenom,
      email: signer.invited_email ?? "",
      telephone: "",
      dateNaissance: "",
      lieuNaissance: "",
      nationalite: "Française",
      adresse: "",
      isLinked: false,
      isPlaceholder: false,
    };
  }

  // 3. Email uniquement (vrai email, pas placeholder)
  if (signer.invited_email && !isPlaceholderEmail(signer.invited_email)) {
    const fromEmail = signer.invited_email.split("@")[0].replace(/[._]/g, " ");
    return {
      prenom: "",
      nom: fromEmail || signer.invited_email,
      email: signer.invited_email,
      telephone: "",
      dateNaissance: "",
      lieuNaissance: "",
      nationalite: "Française",
      adresse: "",
      isLinked: false,
      isPlaceholder: false,
    };
  }

  // 4. Aucune donnée exploitable
  return empty;
}

/**
 * Raccourci : retourne "Prénom Nom" (ou nom seul, ou placeholder).
 */
export function resolveTenantFullName(signer: SignerLike | null | undefined): string {
  const d = resolveTenantDisplay(signer);
  const full = [d.prenom, d.nom].filter(Boolean).join(" ");
  return full || d.nom;
}

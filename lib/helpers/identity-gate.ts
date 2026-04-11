import { redirect } from "next/navigation";

/**
 * Identity Gate — Server-side (Node.js layouts)
 *
 * Vérifie que le profil utilisateur a le niveau d'identité requis
 * pour accéder à la route courante. Redirige vers l'étape d'onboarding
 * appropriée si le niveau est insuffisant.
 *
 * Appelé depuis les layouts serveur (owner, tenant) qui ont déjà
 * le profil chargé — zéro requête DB supplémentaire.
 */

type IdentityStatus =
  | "unverified"
  | "phone_verified"
  | "document_uploaded"
  | "identity_review"
  | "identity_verified"
  | "identity_rejected";

type RequiredLevel = "phone_verified" | "document_uploaded" | "identity_verified";

interface RouteGate {
  pattern: RegExp;
  required: RequiredLevel;
  roles?: string[];
}

const ROUTE_GATES: RouteGate[] = [
  // Routes spécifiques d'abord (plus restrictives)
  { pattern: /^\/owner\/leases\/.*\/sign/, required: "identity_verified", roles: ["owner", "agency"] },
  { pattern: /^\/tenant\/leases\/.*\/sign/, required: "identity_verified", roles: ["tenant"] },
  { pattern: /^\/tenant\/apply/, required: "document_uploaded", roles: ["tenant"] },
  { pattern: /^\/owner\/payments/, required: "identity_verified", roles: ["owner", "agency"] },
  { pattern: /^\/owner\/inspections\/.*\/(create|sign)/, required: "identity_verified" },
  { pattern: /^\/agency\/mandates\/.*\/sign/, required: "identity_verified", roles: ["agency"] },
  { pattern: /^\/syndic\/assemblies\/.*\/sign/, required: "identity_verified", roles: ["syndic"] },
  // Routes générales (niveau minimum requis pour accéder au dashboard)
  // Les pages d'onboarding sont exclues (pas de gate sur /*/onboarding)
  { pattern: /^\/owner(?!\/onboarding)/, required: "phone_verified" },
  { pattern: /^\/tenant(?!\/onboarding)/, required: "phone_verified" },
  { pattern: /^\/agency(?!\/onboarding)/, required: "phone_verified", roles: ["agency"] },
  { pattern: /^\/provider(?!\/onboarding)/, required: "phone_verified", roles: ["provider"] },
  { pattern: /^\/syndic(?!\/onboarding)/, required: "phone_verified", roles: ["syndic"] },
  { pattern: /^\/guarantor(?!\/onboarding)/, required: "phone_verified", roles: ["guarantor"] },
];

const STATUS_ORDER: IdentityStatus[] = [
  "unverified",
  "phone_verified",
  "document_uploaded",
  "identity_review",
  "identity_verified",
  "identity_rejected",
];

function meetsRequirement(current: IdentityStatus, required: RequiredLevel): boolean {
  if (current === "identity_rejected") return false;
  if (current === "identity_review" && required !== "identity_verified") return true;
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(required);
}

function getRedirectPath(status: IdentityStatus, role?: string): string {
  // La page /onboarding/phone est mutualisée pour tous les rôles.
  // Elle lit le rôle du profil et propose le parcours approprié.
  if (status === "unverified") return "/onboarding/phone";
  if (status === "phone_verified") {
    // Rediriger vers l'onboarding spécifique du rôle plutôt que /onboarding/profile
    if (role && ["owner", "tenant", "provider", "guarantor", "agency", "syndic"].includes(role)) {
      return `/${role}/onboarding/profile`;
    }
    return "/onboarding/profile";
  }
  if (status === "document_uploaded" || status === "identity_review") return "/onboarding/pending";
  if (status === "identity_rejected") return "/onboarding/rejected";
  return "/onboarding";
}

/**
 * Vérifie le gate d'identité pour le pathname courant.
 * Redirige (throw) si le niveau est insuffisant.
 * Ne fait rien si aucun gate ne correspond.
 */
export function checkIdentityGate(
  pathname: string,
  role: string,
  identityStatus: IdentityStatus | string | null | undefined
): void {
  const status = (identityStatus || "unverified") as IdentityStatus;

  // Trouver le gate le plus spécifique qui correspond
  const gate = ROUTE_GATES.find(
    (g) => g.pattern.test(pathname) && (!g.roles || g.roles.includes(role))
  );

  if (!gate) return;

  if (!meetsRequirement(status, gate.required)) {
    const target = getRedirectPath(status, role);
    redirect(`${target}?from=${encodeURIComponent(pathname)}`);
  }
}

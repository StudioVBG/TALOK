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
  // Routes générales ensuite
  { pattern: /^\/owner/, required: "phone_verified" },
  { pattern: /^\/tenant/, required: "phone_verified" },
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

function getRedirectPath(status: IdentityStatus): string {
  if (status === "unverified") return "/onboarding/phone";
  if (status === "phone_verified") return "/onboarding/profile";
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
    const target = getRedirectPath(status);
    redirect(`${target}?from=${encodeURIComponent(pathname)}`);
  }
}

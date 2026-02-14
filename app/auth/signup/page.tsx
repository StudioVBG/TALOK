import { redirect } from "next/navigation";

/**
 * Redirection vers le nouveau parcours d'inscription optimisé.
 * L'ancien parcours /auth/signup est obsolète.
 * Transmet les query params (invite, role, email, redirect) pour ne pas casser
 * les liens générés par /invite/copro et autres invitations.
 */
export default function OldSignUpPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    }
  }
  const qs = params.toString();
  redirect(qs ? `/signup/role?${qs}` : "/signup/role");
}

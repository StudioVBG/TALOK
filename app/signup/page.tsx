import { redirect } from "next/navigation";

/**
 * Point d'entrée du flux d'inscription.
 * Redirige immédiatement vers la sélection du rôle.
 * Les query params (invite, role, code) sont transmis pour ne pas casser
 * les liens d'invitation.
 */
export default function SignupPage({
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

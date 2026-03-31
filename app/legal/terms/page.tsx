import { redirect } from "next/navigation";

/**
 * Redirection /legal/terms → /legal/cgu
 * L'ancienne route /legal/terms est conservée pour compatibilité,
 * mais redirige désormais vers la page CGU canonique.
 */
export default function TermsRedirectPage() {
  redirect("/legal/cgu");
}

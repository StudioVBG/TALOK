import { redirect } from "next/navigation";

/**
 * Redirection vers le nouveau parcours d'inscription optimisé
 * L'ancien parcours /auth/signup est obsolète
 */
export default function OldSignUpPage() {
  redirect("/signup/role");
}

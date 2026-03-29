import { redirect } from "next/navigation";

/**
 * /login — Redirige vers /auth/signin
 *
 * Évite les 404 quand un lien externe pointe vers /login.
 */
export default function LoginPage() {
  redirect("/auth/signin");
}

import { redirect } from "next/navigation";

/**
 * /signup → redirige vers /signup/role
 * Server Component uniquement (pas de 'use client', pas de hooks).
 */
export default function SignupPage() {
  redirect("/signup/role");
}

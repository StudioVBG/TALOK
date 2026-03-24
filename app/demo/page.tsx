import { redirect } from "next/navigation";

/**
 * Redirection /demo → /contact
 * Le CTA "Demander une démo" redirige vers le formulaire de contact.
 */
export default function DemoPage() {
  redirect("/contact");
}

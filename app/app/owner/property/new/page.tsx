// @ts-nocheck
import { redirect } from "next/navigation";

/**
 * Redirection vers la nouvelle route de création de bien
 * Cette route est obsolète, redirige vers /app/owner/properties/new
 */
export default function NewPropertyWizard() {
  redirect("/app/owner/properties/new");
}


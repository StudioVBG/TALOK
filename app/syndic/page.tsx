import { redirect } from "next/navigation";

/**
 * Page racine /syndic
 * Redirige automatiquement vers le dashboard syndic
 */
export default function SyndicPage() {
  redirect("/syndic/dashboard");
}

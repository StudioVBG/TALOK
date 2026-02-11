import { redirect } from "next/navigation";

/**
 * Page racine /syndic
 * Redirige automatiquement vers le dashboard
 */
export default function SyndicPage() {
  redirect("/syndic/dashboard");
}

import { redirect } from "next/navigation";

/**
 * Page racine /copro
 * Redirige automatiquement vers le dashboard
 */
export default function CoproPage() {
  redirect("/copro/dashboard");
}

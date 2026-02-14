import { redirect } from "next/navigation";

/**
 * Page racine /guarantor → redirection vers /guarantor/dashboard
 * Cohérent avec /owner, /tenant, /provider, /admin, /agency
 */
export default function GuarantorPage() {
  redirect("/guarantor/dashboard");
}

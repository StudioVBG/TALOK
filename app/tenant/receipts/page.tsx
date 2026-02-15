import { redirect } from "next/navigation";

/**
 * AUDIT UX : /tenant/receipts est désormais unifié dans /tenant/documents
 * Cette page redirige automatiquement vers le Document Center
 * avec un filtre pré-appliqué sur les quittances.
 */
export default function TenantReceiptsRedirect() {
  redirect("/tenant/documents?type=quittance");
}

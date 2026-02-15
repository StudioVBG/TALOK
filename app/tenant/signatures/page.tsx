import { redirect } from "next/navigation";

/**
 * AUDIT UX : /tenant/signatures est désormais unifié dans /tenant/documents
 * Les actions de signature sont accessibles depuis la zone "À faire" du Document Center.
 */
export default function TenantSignaturesRedirect() {
  redirect("/tenant/documents");
}

import { redirect } from "next/navigation";

/**
 * /admin/reports is now consolidated into /admin/accounting.
 * The accounting page has exports (CSV, Excel, FEC) and full financial reporting.
 */
export default function AdminReportsRedirect() {
  redirect("/admin/accounting");
}

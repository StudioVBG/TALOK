import { getTenantInvoices } from "@/features/billing/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { TenantPaymentsClient } from "./TenantPaymentsClient";

export default async function TenantPaymentsPage() {
  const invoices = await getTenantInvoices();

  return (
    <PullToRefreshContainer>
      <TenantPaymentsClient invoices={invoices} />
    </PullToRefreshContainer>
  );
}

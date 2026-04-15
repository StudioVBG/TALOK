import {
  getTenantInvoices,
  getTenantPendingCashReceipts,
} from "@/features/billing/server/data-fetching";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { TenantPaymentsClient } from "./TenantPaymentsClient";

export default async function TenantPaymentsPage() {
  const [invoices, pendingCashReceipts] = await Promise.all([
    getTenantInvoices(),
    getTenantPendingCashReceipts(),
  ]);

  return (
    <PullToRefreshContainer>
      <TenantPaymentsClient
        invoices={invoices}
        pendingCashReceipts={pendingCashReceipts}
      />
    </PullToRefreshContainer>
  );
}

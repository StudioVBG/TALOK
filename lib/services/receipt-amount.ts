export function resolveReceiptTotalAmount(
  invoiceTotal: number | string | null | undefined,
  paymentAmount: number | string | null | undefined
) {
  const normalizedInvoiceTotal = Number(invoiceTotal || 0);
  if (normalizedInvoiceTotal > 0) {
    return normalizedInvoiceTotal;
  }

  return Number(paymentAmount || 0) || 0;
}

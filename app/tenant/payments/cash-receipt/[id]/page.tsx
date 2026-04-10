import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TenantCashReceiptSignatureClient } from "./TenantCashReceiptSignatureClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantCashReceiptSignaturePage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/tenant/payments/cash-receipt/${id}`);
  }

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: receipt, error } = await serviceClient
    .from("cash_receipts")
    .select(`
      id,
      amount,
      amount_words,
      receipt_number,
      periode,
      status,
      owner_signature,
      owner_signed_at,
      tenant_signature,
      tenant_signed_at,
      notes,
      tenant_id,
      invoice:invoices(id, periode),
      owner:profiles!cash_receipts_owner_id_fkey(id, prenom, nom),
      property:properties(id, adresse_complete)
    `)
    .eq("id", id)
    .single();

  if (error || !receipt) {
    notFound();
  }

  const receiptAny = receipt as any;

  // Vérifier que le reçu est bien adressé au locataire courant
  if (receiptAny.tenant_id !== profile.id && profile.role !== "admin") {
    notFound();
  }

  const ownerName = `${receiptAny.owner?.prenom ?? ""} ${receiptAny.owner?.nom ?? ""}`.trim() || "Propriétaire";
  const tenantName = `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "Locataire";

  return (
    <TenantCashReceiptSignatureClient
      receiptId={receiptAny.id}
      receiptNumber={receiptAny.receipt_number}
      amount={Number(receiptAny.amount)}
      amountWords={receiptAny.amount_words}
      periode={receiptAny.periode}
      status={receiptAny.status}
      ownerName={ownerName}
      tenantName={tenantName}
      propertyAddress={receiptAny.property?.adresse_complete ?? ""}
      ownerSignature={receiptAny.owner_signature}
      ownerSignedAt={receiptAny.owner_signed_at}
      existingTenantSignature={receiptAny.tenant_signature}
      notes={receiptAny.notes}
    />
  );
}

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { fetchTenantInvoices } from "../_data/fetchTenantInvoices";
import { TenantPaymentsClient } from "./TenantPaymentsClient";

export default async function TenantPaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const invoices = await fetchTenantInvoices(user.id);

  return <TenantPaymentsClient invoices={invoices} />;
}

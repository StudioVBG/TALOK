import { createClient } from "@/lib/supabase/server";

export interface AdminStatsData {
  totalUsers: number;
  usersByRole: {
    admin: number;
    owner: number;
    tenant: number;
    provider: number;
  };
  totalProperties: number;
  propertiesByType: Record<string, number>;
  totalLeases: number;
  activeLeases: number;
  leasesByStatus: Record<string, number>;
  totalInvoices: number;
  unpaidInvoices: number;
  invoicesByStatus: Record<string, number>;
  totalTickets: number;
  openTickets: number;
  ticketsByStatus: Record<string, number>;
  totalDocuments: number;
  totalBlogPosts: number;
  publishedBlogPosts: number;
  recentActivity: any[];
}

export async function fetchAdminStats(): Promise<AdminStatsData | null> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Non authentifié");
  }

  const { data, error } = await supabase.rpc("admin_stats");

  if (error) {
    console.error("[fetchAdminStats] RPC Error:", error);
    return null;
  }

  return data as AdminStatsData;
}

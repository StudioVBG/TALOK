// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * GET /api/admin/stats - Statistiques admin
 * Configuration Vercel: maxDuration: 10s
 */
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseClient = getTypedSupabaseClient(supabase);

    // Récupérer toutes les statistiques en parallèle
    const [
      users,
      properties,
      leases,
      invoices,
      tickets,
      documents,
      blogPosts,
    ] = await Promise.all([
      supabaseClient.from("profiles").select("role"),
      supabaseClient.from("properties").select("type"),
      supabaseClient.from("leases").select("statut"),
      supabaseClient.from("invoices").select("statut"),
      supabaseClient.from("tickets").select("statut"),
      supabaseClient.from("documents").select("id"),
      supabaseClient.from("blog_posts").select("is_published"),
    ]);

    // Log pour diagnostic
    if (users.error) {
      console.error("Error fetching users in stats:", users.error);
    } else {
      console.log(`Stats: Found ${users.data?.length || 0} profiles`);
    }

    // Calculer les statistiques
    const usersArray = (users.data as any[]) || [];
    console.log("Stats: Users by role:", {
      admin: usersArray?.filter((u: any) => u.role === "admin").length || 0,
      owner: usersArray?.filter((u: any) => u.role === "owner").length || 0,
      tenant: usersArray?.filter((u: any) => u.role === "tenant").length || 0,
      provider: usersArray?.filter((u: any) => u.role === "provider").length || 0,
    });
    const usersByRole = {
      admin: usersArray?.filter((u: any) => u.role === "admin").length || 0,
      owner: usersArray?.filter((u: any) => u.role === "owner").length || 0,
      tenant: usersArray?.filter((u: any) => u.role === "tenant").length || 0,
      provider: usersArray?.filter((u: any) => u.role === "provider").length || 0,
    };

    const propertiesArray = (properties.data as any[]) || [];
    const propertiesByType = {
      appartement: propertiesArray?.filter((p: any) => p.type === "appartement").length || 0,
      maison: propertiesArray?.filter((p: any) => p.type === "maison").length || 0,
      colocation: propertiesArray?.filter((p: any) => p.type === "colocation").length || 0,
      saisonnier: propertiesArray?.filter((p: any) => p.type === "saisonnier").length || 0,
    };

    const leasesArray = (leases.data as any[]) || [];
    const leasesByStatus = {
      draft: leasesArray?.filter((l: any) => l.statut === "draft").length || 0,
      pending_signature: leasesArray?.filter((l: any) => l.statut === "pending_signature").length || 0,
      active: leasesArray?.filter((l: any) => l.statut === "active").length || 0,
      terminated: leasesArray?.filter((l: any) => l.statut === "terminated").length || 0,
    };

    const invoicesArray = (invoices.data as any[]) || [];
    const invoicesByStatus = {
      draft: invoicesArray?.filter((i: any) => i.statut === "draft").length || 0,
      sent: invoicesArray?.filter((i: any) => i.statut === "sent").length || 0,
      paid: invoicesArray?.filter((i: any) => i.statut === "paid").length || 0,
      late: invoicesArray?.filter((i: any) => i.statut === "late").length || 0,
    };

    const ticketsArray = (tickets.data as any[]) || [];
    const ticketsByStatus = {
      open: ticketsArray?.filter((t: any) => t.statut === "open").length || 0,
      in_progress: ticketsArray?.filter((t: any) => t.statut === "in_progress").length || 0,
      resolved: ticketsArray?.filter((t: any) => t.statut === "resolved").length || 0,
      closed: ticketsArray?.filter((t: any) => t.statut === "closed").length || 0,
    };

    // Récupérer l'activité récente
    const [recentLeases, recentInvoices, recentTickets] = await Promise.all([
      supabase
        .from("leases")
        .select("id, created_at, statut")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("invoices")
        .select("id, created_at, statut")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("tickets")
        .select("id, created_at, statut, titre")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const activities: Array<{ type: string; description: string; date: string }> = [];

    const recentLeasesArray = (recentLeases.data as any[]) || [];
    recentLeasesArray?.forEach((lease: any) => {
      activities.push({
        type: "lease",
        description: `Nouveau bail créé (${lease.statut})`,
        date: lease.created_at,
      });
    });

    const recentInvoicesArray = (recentInvoices.data as any[]) || [];
    recentInvoicesArray?.forEach((invoice: any) => {
      activities.push({
        type: "invoice",
        description: `Nouvelle facture créée (${invoice.statut})`,
        date: invoice.created_at,
      });
    });

    const recentTicketsArray = (recentTickets.data as any[]) || [];
    recentTicketsArray?.forEach((ticket: any) => {
      activities.push({
        type: "ticket",
        description: `Nouveau ticket: ${ticket.titre} (${ticket.statut})`,
        date: ticket.created_at,
      });
    });

    // Trier par date et prendre les 10 plus récents
    const recentActivity = activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return NextResponse.json({
      totalUsers: users.data?.length || 0,
      totalProperties: properties.data?.length || 0,
      totalLeases: leases.data?.length || 0,
      activeLeases: leasesByStatus.active,
      totalInvoices: invoicesArray?.length || 0,
      unpaidInvoices: invoicesByStatus.sent + invoicesByStatus.late,
      totalTickets: ticketsArray?.length || 0,
      openTickets: ticketsByStatus.open + ticketsByStatus.in_progress,
      totalDocuments: (documents.data as any[])?.length || 0,
      totalBlogPosts: (blogPosts.data as any[])?.length || 0,
      publishedBlogPosts: ((blogPosts.data as any[]) || [])?.filter((p: any) => p.is_published).length || 0,
      usersByRole,
      propertiesByType,
      leasesByStatus,
      invoicesByStatus,
      ticketsByStatus,
      recentActivity,
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/stats:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}


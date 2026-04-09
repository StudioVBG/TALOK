import { Suspense } from "react";
import {
  CalendarDays,
  Home,
  Users,
  Sparkles,
  Euro,
  BarChart3,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { SeasonalDashboardClient } from "./SeasonalDashboardClient";
import { SeasonalGate } from "./SeasonalGate";

export const dynamic = "force-dynamic";

async function getSeasonalStats(ownerId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [listingsRes, activeRes, pendingCheckinRes, pendingCleaningRes, revenueRes] =
    await Promise.allSettled([
      supabase
        .from("seasonal_listings")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", ownerId),
      supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .in("listing_id",
          (await supabase.from("seasonal_listings").select("id").eq("owner_id", ownerId)).data?.map((l: { id: string }) => l.id) ?? []
        )
        .in("status", ["confirmed", "checked_in"]),
      supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .in("listing_id",
          (await supabase.from("seasonal_listings").select("id").eq("owner_id", ownerId)).data?.map((l: { id: string }) => l.id) ?? []
        )
        .eq("status", "confirmed")
        .lte("check_in", today),
      supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .in("listing_id",
          (await supabase.from("seasonal_listings").select("id").eq("owner_id", ownerId)).data?.map((l: { id: string }) => l.id) ?? []
        )
        .eq("cleaning_status", "pending")
        .eq("status", "checked_out"),
      supabase
        .from("reservations")
        .select("total_cents")
        .in("listing_id",
          (await supabase.from("seasonal_listings").select("id").eq("owner_id", ownerId)).data?.map((l: { id: string }) => l.id) ?? []
        )
        .gte("check_in", firstOfMonth)
        .in("status", ["confirmed", "checked_in", "checked_out"]),
    ]);

  const revenueCents = revenueRes.status === "fulfilled"
    ? (revenueRes.value.data ?? []).reduce((acc: number, r: { total_cents: number }) => acc + (r.total_cents || 0), 0)
    : 0;

  return {
    total_listings: listingsRes.status === "fulfilled" ? (listingsRes.value.count ?? 0) : 0,
    active_reservations: activeRes.status === "fulfilled" ? (activeRes.value.count ?? 0) : 0,
    pending_checkins: pendingCheckinRes.status === "fulfilled" ? (pendingCheckinRes.value.count ?? 0) : 0,
    pending_cleaning: pendingCleaningRes.status === "fulfilled" ? (pendingCleaningRes.value.count ?? 0) : 0,
    revenue_this_month_cents: revenueCents,
    occupancy_rate: 0,
  };
}

export default async function SeasonalDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "agency" && profile.role !== "admin")) {
    redirect("/owner/dashboard");
  }

  const stats = await getSeasonalStats(profile.id);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

  return (
    <SeasonalGate>
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Location saisonnière
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos réservations courte durée, check-in/check-out et ménage
          </p>
        </div>
        <Link href="/owner/seasonal/listings/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle annonce
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Home className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Annonces</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total_listings}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Réservations actives</p>
              <p className="text-2xl font-bold text-green-600">{stats.active_reservations}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Check-ins en attente</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending_checkins}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ménages à faire</p>
              <p className="text-2xl font-bold text-purple-600">{stats.pending_cleaning}</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Euro className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">CA ce mois</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(stats.revenue_this_month_cents)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        }
      >
        <SeasonalDashboardClient />
      </Suspense>
    </div>
    </SeasonalGate>
  );
}

import { Suspense } from "react";
import { CalendarDays, CalendarCheck, Clock, Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingsList } from "@/components/visit-scheduling";

export const dynamic = "force-dynamic";

export default async function TenantVisitsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Mes visites
          </h1>
          <p className="text-slate-500 mt-1">
            Gérez vos réservations de visite
          </p>
        </div>
        <Button asChild>
          <Link href="/search">
            <Search className="mr-2 h-4 w-4" />
            Rechercher un logement
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">-</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CalendarCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Confirmées</p>
              <p className="text-2xl font-bold text-green-600">-</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Effectuées</p>
              <p className="text-2xl font-bold text-blue-600">-</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        <BookingsList role="tenant" />
      </Suspense>
    </div>
  );
}

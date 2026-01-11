import { Suspense } from "react";
import { CalendarDays, Clock, Users, CheckCircle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BookingsList } from "@/components/visit-scheduling";
import { OwnerAvailabilitySection } from "./availability-section";

export const dynamic = "force-dynamic";

export default async function OwnerVisitsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Visites
          </h1>
          <p className="text-slate-500 mt-1">
            Gérez vos disponibilités et les demandes de visite
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <CheckCircle className="h-5 w-5 text-green-600" />
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
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Ce mois</p>
              <p className="text-2xl font-bold text-blue-600">-</p>
            </div>
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total</p>
              <p className="text-2xl font-bold text-purple-600">-</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="bookings" className="space-y-6">
        <TabsList className="bg-white border">
          <TabsTrigger value="bookings">Demandes de visite</TabsTrigger>
          <TabsTrigger value="availability">Mes disponibilités</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <Suspense
            fallback={
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            }
          >
            <BookingsList role="owner" />
          </Suspense>
        </TabsContent>

        <TabsContent value="availability">
          <Suspense
            fallback={
              <div className="space-y-4">
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            }
          >
            <OwnerAvailabilitySection />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

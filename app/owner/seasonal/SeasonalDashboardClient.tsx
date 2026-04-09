"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, List, Home, Plus } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import {
  useSeasonalListings,
  useReservations,
  useReservationAction,
} from "@/features/seasonal/hooks/use-seasonal";
import { ReservationCard } from "@/features/seasonal/components/ReservationCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function SeasonalDashboardClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: listingsData, isLoading: listingsLoading } = useSeasonalListings();
  const { data: reservationsData, isLoading: reservationsLoading } = useReservations();
  const reservationAction = useReservationAction();

  const listings = listingsData?.listings ?? [];
  const reservations = reservationsData?.reservations ?? [];

  const upcoming = reservations.filter((r) => ["confirmed", "pending"].includes(r.status));
  const inProgress = reservations.filter((r) => r.status === "checked_in");
  const past = reservations.filter((r) => ["checked_out", "cancelled", "no_show"].includes(r.status));

  async function handleAction(id: string, action: "check-in" | "check-out" | "cancel") {
    try {
      await reservationAction.mutateAsync({ id, action });
      toast({
        title: action === "check-in" ? "Check-in effectué" : action === "check-out" ? "Check-out effectué" : "Réservation annulée",
      });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Erreur", variant: "destructive" });
    }
  }

  return (
    <Tabs defaultValue="reservations" className="space-y-6">
      <TabsList className="bg-card border">
        <TabsTrigger value="reservations">
          <List className="h-4 w-4 mr-2" /> Réservations
        </TabsTrigger>
        <TabsTrigger value="listings">
          <Home className="h-4 w-4 mr-2" /> Annonces
        </TabsTrigger>
      </TabsList>

      {/* Reservations Tab */}
      <TabsContent value="reservations" className="space-y-6">
        {reservationsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Aucune réservation</p>
              <p className="text-sm text-muted-foreground">Créez une annonce pour recevoir des réservations</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* In Progress */}
            {inProgress.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  En cours ({inProgress.length})
                </h2>
                <div className="space-y-3">
                  {inProgress.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onCheckOut={(id) => handleAction(id, "check-out")}
                      onClick={(id) => router.push(`/owner/seasonal/reservations/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  À venir ({upcoming.length})
                </h2>
                <div className="space-y-3">
                  {upcoming.map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onCheckIn={(id) => handleAction(id, "check-in")}
                      onCancel={(id) => handleAction(id, "cancel")}
                      onClick={(id) => router.push(`/owner/seasonal/reservations/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  Passées ({past.length})
                </h2>
                <div className="space-y-3">
                  {past.slice(0, 10).map((r) => (
                    <ReservationCard
                      key={r.id}
                      reservation={r}
                      onClick={(id) => router.push(`/owner/seasonal/reservations/${id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </TabsContent>

      {/* Listings Tab */}
      <TabsContent value="listings" className="space-y-4">
        {listingsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Aucune annonce</p>
              <Link href="/owner/seasonal/listings/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" /> Créer une annonce
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map((listing) => (
              <Link key={listing.id} href={`/owner/seasonal/listings/${listing.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{listing.title}</CardTitle>
                      <Badge variant={listing.is_published ? "default" : "secondary"}>
                        {listing.is_published ? "Publiée" : "Brouillon"}
                      </Badge>
                    </div>
                    {listing.property && (
                      <p className="text-sm text-muted-foreground">
                        {listing.property.adresse_complete}, {listing.property.ville}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Min nuits</p>
                        <p className="font-medium">{listing.min_nights}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Max voyageurs</p>
                        <p className="font-medium">{listing.max_guests}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ménage</p>
                        <p className="font-medium">
                          {listing.cleaning_fee_cents > 0
                            ? `${(listing.cleaning_fee_cents / 100).toFixed(0)} €`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

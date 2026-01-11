"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parse, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarCheck,
  Clock,
  User,
  Phone,
  Mail,
  MessageSquare,
  Check,
  X,
  Loader2,
  Calendar,
  Users,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types
interface VisitBooking {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  tenant_message: string | null;
  owner_notes: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  party_size: number;
  booked_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  slot: {
    id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
  };
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
  };
  tenant: {
    id: string;
    prenom: string;
    nom: string;
    telephone: string | null;
    email: string | null;
  };
}

interface BookingsListProps {
  propertyId?: string;
  role: "owner" | "tenant";
}

// API Functions
async function fetchBookings(
  propertyId?: string,
  upcoming?: boolean
): Promise<{ bookings: VisitBooking[]; stats: any }> {
  const params = new URLSearchParams();
  if (propertyId) params.set("property_id", propertyId);
  if (upcoming) params.set("upcoming", "true");

  const res = await fetch(`/api/visit-scheduling/bookings?${params}`);
  if (!res.ok) throw new Error("Erreur lors du chargement des réservations");
  return res.json();
}

async function updateBooking(
  id: string,
  data: { status: string; cancellation_reason?: string; owner_notes?: string }
): Promise<any> {
  const res = await fetch(`/api/visit-scheduling/bookings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la mise à jour");
  }
  return res.json();
}

// Status badge component
function StatusBadge({ status }: { status: VisitBooking["status"] }) {
  const config = {
    pending: {
      label: "En attente",
      variant: "outline" as const,
      className: "border-yellow-500 text-yellow-700 dark:text-yellow-400",
    },
    confirmed: {
      label: "Confirmée",
      variant: "default" as const,
      className: "bg-green-500",
    },
    cancelled: {
      label: "Annulée",
      variant: "secondary" as const,
      className: "bg-muted text-muted-foreground",
    },
    completed: {
      label: "Terminée",
      variant: "outline" as const,
      className: "border-blue-500 text-blue-700 dark:text-blue-400",
    },
    no_show: {
      label: "Absent",
      variant: "destructive" as const,
      className: "",
    },
  };

  const { label, variant, className } = config[status];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

// Main component
export function BookingsList({ propertyId, role }: BookingsListProps) {
  const [selectedBooking, setSelectedBooking] = useState<VisitBooking | null>(null);
  const [actionType, setActionType] = useState<"confirm" | "cancel" | "complete" | "no_show" | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");

  const queryClient = useQueryClient();

  // Query bookings
  const { data, isLoading, error } = useQuery({
    queryKey: ["visit-bookings", propertyId],
    queryFn: () => fetchBookings(propertyId),
  });

  const bookings = data?.bookings || [];
  const stats = data?.stats;

  // Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-bookings", propertyId] });
      setSelectedBooking(null);
      setActionType(null);
      setCancellationReason("");
    },
  });

  // Helper to check if a booking slot is in the past
  const isSlotPast = (slot: { slot_date: string; start_time: string }) => {
    // Combine date and time to create a full datetime
    const dateTimeStr = `${slot.slot_date} ${slot.start_time.slice(0, 5)}`;
    const slotDateTime = parse(dateTimeStr, "yyyy-MM-dd HH:mm", new Date());
    return isPast(slotDateTime);
  };

  // Filter bookings
  const upcomingBookings = bookings.filter(
    (b) =>
      ["pending", "confirmed"].includes(b.status) &&
      !isSlotPast(b.slot)
  );
  const pastBookings = bookings.filter(
    (b) =>
      !["pending", "confirmed"].includes(b.status) ||
      isSlotPast(b.slot)
  );

  // Format helpers
  const formatTime = (timeString: string) => timeString.slice(0, 5);
  const formatDate = (dateString: string) => {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    return format(date, "EEE d MMM", { locale: fr });
  };
  const formatFullDate = (dateString: string) => {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    return format(date, "EEEE d MMMM yyyy", { locale: fr });
  };

  // Handle action
  const handleAction = (booking: VisitBooking, action: typeof actionType) => {
    setSelectedBooking(booking);
    setActionType(action);
  };

  const confirmAction = () => {
    if (!selectedBooking || !actionType) return;

    const statusMap = {
      confirm: "confirmed",
      cancel: "cancelled",
      complete: "completed",
      no_show: "no_show",
    };

    updateMutation.mutate({
      id: selectedBooking.id,
      data: {
        status: statusMap[actionType],
        cancellation_reason: actionType === "cancel" ? cancellationReason : undefined,
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/50 mb-4" />
          <h3 className="text-lg font-medium">Erreur de chargement</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Impossible de charger les réservations
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderBookingCard = (booking: VisitBooking) => {
    const isUpcoming =
      ["pending", "confirmed"].includes(booking.status) &&
      !isSlotPast(booking.slot);
    const isPending = booking.status === "pending";
    const isConfirmed = booking.status === "confirmed";

    return (
      <div
        key={booking.id}
        className={cn(
          "rounded-lg border p-4 space-y-3 transition-colors",
          isPending && "border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20",
          isConfirmed && isUpcoming && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium capitalize">
                  {formatDate(booking.slot.slot_date)}
                </span>
                <span className="text-muted-foreground">
                  {formatTime(booking.slot.start_time)} -{" "}
                  {formatTime(booking.slot.end_time)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {booking.property.adresse_complete}
              </p>
            </div>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <Separator />

        {/* Tenant Info (for owners) */}
        {role === "owner" && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>
                  {booking.tenant.prenom} {booking.tenant.nom}
                </span>
                {booking.party_size > 1 && (
                  <Badge variant="outline" className="text-xs">
                    +{booking.party_size - 1}
                  </Badge>
                )}
              </div>
              {(booking.contact_phone || booking.tenant.telephone) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`tel:${booking.contact_phone || booking.tenant.telephone}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      {booking.contact_phone || booking.tenant.telephone}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {(booking.contact_email || booking.tenant.email) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`mailto:${booking.contact_email || booking.tenant.email}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      {booking.contact_email || booking.tenant.email}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Actions */}
            {isUpcoming && (
              <div className="flex items-center gap-2">
                {isPending && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleAction(booking, "confirm")}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Confirmer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleAction(booking, "cancel")}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Refuser
                    </Button>
                  </>
                )}
                {isConfirmed && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(booking, "complete")}
                    >
                      <CalendarCheck className="mr-1 h-4 w-4" />
                      Terminée
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => handleAction(booking, "no_show")}
                    >
                      Absent
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Message */}
        {booking.tenant_message && (
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm">{booking.tenant_message}</p>
            </div>
          </div>
        )}

        {/* Cancellation reason */}
        {booking.status === "cancelled" && booking.cancellation_reason && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              Raison: {booking.cancellation_reason}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Réservations de visites
              </CardTitle>
              <CardDescription>
                {role === "owner"
                  ? "Gérez les demandes de visite de vos biens"
                  : "Vos réservations de visite"}
              </CardDescription>
            </div>

            {/* Stats for owners */}
            {role === "owner" && stats && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span>{stats.pending} en attente</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span>{stats.confirmed} confirmées</span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Aucune réservation</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {role === "owner"
                  ? "Vous n'avez pas encore reçu de demandes de visite"
                  : "Vous n'avez pas encore réservé de visite"}
              </p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="upcoming">
                  À venir ({upcomingBookings.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  Passées ({pastBookings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {upcomingBookings.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Aucune visite à venir
                      </p>
                    ) : (
                      upcomingBookings.map(renderBookingCard)
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="past">
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {pastBookings.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Aucune visite passée
                      </p>
                    ) : (
                      pastBookings.map(renderBookingCard)
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog
        open={!!actionType}
        onOpenChange={() => {
          setActionType(null);
          setCancellationReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "confirm" && "Confirmer la visite"}
              {actionType === "cancel" && "Refuser la visite"}
              {actionType === "complete" && "Marquer comme terminée"}
              {actionType === "no_show" && "Marquer comme absent"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "confirm" &&
                "Le locataire sera notifié de la confirmation."}
              {actionType === "cancel" &&
                "Le locataire sera notifié du refus et le créneau sera libéré."}
              {actionType === "complete" && "La visite a-t-elle bien eu lieu ?"}
              {actionType === "no_show" &&
                "Le locataire ne s'est pas présenté à la visite."}
            </DialogDescription>
          </DialogHeader>

          {actionType === "cancel" && (
            <div className="py-4">
              <Textarea
                placeholder="Raison du refus (optionnel)"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setCancellationReason("");
              }}
            >
              Annuler
            </Button>
            <Button
              variant={actionType === "cancel" || actionType === "no_show" ? "destructive" : "default"}
              onClick={confirmAction}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

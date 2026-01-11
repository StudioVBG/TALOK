"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Mail,
  MessageSquare,
  Loader2,
  AlertCircle,
  X,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface VisitBooking {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  tenant_message: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  party_size: number;
  booked_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
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
    cover_url: string | null;
  };
}

async function fetchBooking(id: string): Promise<VisitBooking> {
  const res = await fetch(`/api/visit-scheduling/bookings/${id}`);
  if (!res.ok) throw new Error("Réservation non trouvée");
  const data = await res.json();
  return data.booking;
}

async function cancelBooking(id: string, reason?: string): Promise<void> {
  const res = await fetch(`/api/visit-scheduling/bookings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cancellation_reason: reason }),
  });
  if (!res.ok) throw new Error("Erreur lors de l'annulation");
}

async function submitFeedback(
  id: string,
  data: { feedback_rating: number; feedback_comment?: string }
): Promise<void> {
  const res = await fetch(`/api/visit-scheduling/bookings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de l'envoi du feedback");
}

function StatusBadge({ status }: { status: VisitBooking["status"] }) {
  const config = {
    pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800" },
    confirmed: { label: "Confirmée", className: "bg-green-100 text-green-800" },
    cancelled: { label: "Annulée", className: "bg-gray-100 text-gray-800" },
    completed: { label: "Terminée", className: "bg-blue-100 text-blue-800" },
    no_show: { label: "Absent", className: "bg-red-100 text-red-800" },
  };

  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}

export default function TenantVisitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bookingId = params.id as string;

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ["visit-booking", bookingId],
    queryFn: () => fetchBooking(bookingId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(bookingId, cancellationReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-booking", bookingId] });
      setShowCancelDialog(false);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: () =>
      submitFeedback(bookingId, {
        feedback_rating: feedbackRating,
        feedback_comment: feedbackComment || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-booking", bookingId] });
      setShowFeedbackDialog(false);
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            Cette réservation n'existe pas ou vous n'y avez pas accès.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/tenant/visits">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux visites
          </Link>
        </Button>
      </div>
    );
  }

  const formatTime = (isoString: string) => format(parseISO(isoString), "HH:mm");
  const formatDate = (dateString: string) =>
    format(parseISO(dateString), "EEEE d MMMM yyyy", { locale: fr });

  const isUpcoming =
    ["pending", "confirmed"].includes(booking.status) &&
    !isPast(parseISO(booking.slot.start_time));
  const canCancel = isUpcoming;
  const canFeedback = booking.status === "completed" && !booking.feedback_rating;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/tenant/visits">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux visites
        </Link>
      </Button>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Détails de la visite</CardTitle>
              <CardDescription>
                Réservée le{" "}
                {format(parseISO(booking.booked_at), "d MMMM yyyy 'à' HH:mm", {
                  locale: fr,
                })}
              </CardDescription>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Property Info */}
          <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            {booking.property.cover_url && (
              <img
                src={booking.property.cover_url}
                alt="Property"
                className="h-24 w-24 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{booking.property.adresse_complete}</p>
                  <p className="text-sm text-muted-foreground">
                    {booking.property.code_postal} {booking.property.ville}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Visit Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium capitalize">
                  {formatDate(booking.slot.slot_date)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Horaire</p>
                <p className="font-medium">
                  {formatTime(booking.slot.start_time)} -{" "}
                  {formatTime(booking.slot.end_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Personnes</p>
                <p className="font-medium">{booking.party_size}</p>
              </div>
            </div>
            {booking.contact_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{booking.contact_phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Message */}
          {booking.tenant_message && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Votre message</p>
                </div>
                <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                  {booking.tenant_message}
                </p>
              </div>
            </>
          )}

          {/* Cancellation Reason */}
          {booking.status === "cancelled" && booking.cancellation_reason && (
            <>
              <Separator />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Visite annulée</AlertTitle>
                <AlertDescription>{booking.cancellation_reason}</AlertDescription>
              </Alert>
            </>
          )}

          {/* Feedback */}
          {booking.feedback_rating && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <p className="text-sm font-medium">Votre avis</p>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= booking.feedback_rating!
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                {booking.feedback_comment && (
                  <p className="text-sm text-muted-foreground">
                    {booking.feedback_comment}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          {(canCancel || canFeedback) && (
            <>
              <Separator />
              <div className="flex gap-3">
                {canCancel && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annuler la visite
                  </Button>
                )}
                {canFeedback && (
                  <Button onClick={() => setShowFeedbackDialog(true)}>
                    <Star className="mr-2 h-4 w-4" />
                    Donner mon avis
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la visite</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir annuler cette visite ? Le propriétaire sera
              notifié.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Raison de l'annulation (optionnel)"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comment s'est passée la visite ?</DialogTitle>
            <DialogDescription>
              Votre avis aide les propriétaires à améliorer l'expérience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= feedbackRating
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300 hover:text-yellow-400"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Commentaire (optionnel)"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => feedbackMutation.mutate()}
              disabled={feedbackRating === 0 || feedbackMutation.isPending}
            >
              {feedbackMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

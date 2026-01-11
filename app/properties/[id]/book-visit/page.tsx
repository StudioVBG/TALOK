"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Home, CheckCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TimeSlotPicker, BookingForm } from "@/components/visit-scheduling";

interface Property {
  id: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  type: string;
  surface: number;
  nb_pieces: number;
  cover_url: string | null;
  loyer_reference: number | null;
}

interface VisitSlot {
  id: string;
  property_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: "available" | "booked" | "blocked";
  max_visitors: number;
  current_visitors: number;
}

async function fetchProperty(id: string): Promise<Property> {
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok) throw new Error("Propriété non trouvée");
  const data = await res.json();
  return data.property;
}

type BookingStep = "select" | "confirm" | "success";

export default function BookVisitPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;

  const [step, setStep] = useState<BookingStep>("select");
  const [selectedSlot, setSelectedSlot] = useState<VisitSlot | null>(null);
  const [booking, setBooking] = useState<any>(null);

  const { data: property, isLoading, error } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: () => fetchProperty(propertyId),
  });

  const handleSlotSelect = (slot: VisitSlot) => {
    setSelectedSlot(slot);
    setStep("confirm");
  };

  const handleBookingSuccess = (newBooking: any) => {
    setBooking(newBooking);
    setStep("success");
  };

  const handleBack = () => {
    if (step === "confirm") {
      setStep("select");
      setSelectedSlot(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            Ce bien n'existe pas ou n'est plus disponible.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/search">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la recherche
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Back Button */}
      {step !== "success" && (
        <Button variant="ghost" asChild>
          <Link href={`/properties/${propertyId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au bien
          </Link>
        </Button>
      )}

      {/* Property Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {property.cover_url ? (
              <img
                src={property.cover_url}
                alt={property.adresse_complete}
                className="h-20 w-28 rounded-lg object-cover"
              />
            ) : (
              <div className="h-20 w-28 rounded-lg bg-muted flex items-center justify-center">
                <Home className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <p className="font-medium">{property.adresse_complete}</p>
                  <p className="text-sm text-muted-foreground">
                    {property.code_postal} {property.ville}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{property.type}</span>
                <span>{property.surface} m²</span>
                <span>{property.nb_pieces} pièces</span>
                {property.loyer_reference && (
                  <span className="font-medium text-foreground">
                    {property.loyer_reference} €/mois
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {step === "select" && (
        <TimeSlotPicker
          propertyId={propertyId}
          onSlotSelect={handleSlotSelect}
          selectedSlotId={selectedSlot?.id}
        />
      )}

      {step === "confirm" && selectedSlot && (
        <BookingForm
          slot={selectedSlot}
          property={property}
          onSuccess={handleBookingSuccess}
          onCancel={handleBack}
        />
      )}

      {step === "success" && booking && (
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle>Demande de visite envoyée !</CardTitle>
            <CardDescription>
              {booking.status === "confirmed"
                ? "Votre visite est confirmée. Vous recevrez un rappel 24h avant."
                : "Le propriétaire va examiner votre demande. Vous serez notifié de sa décision."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Consultez et gérez vos visites depuis votre espace
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link href="/tenant/visits">Voir mes visites</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/search">Continuer ma recherche</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarCheck, Loader2, MapPin, Clock, User, Phone, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createVisitBookingSchema, type CreateVisitBooking } from "@/lib/validations";

// Types
interface VisitSlot {
  id: string;
  property_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  max_visitors: number;
  current_visitors: number;
}

interface Property {
  id: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  cover_url?: string;
}

interface BookingFormProps {
  slot: VisitSlot;
  property: Property;
  onSuccess: (booking: any) => void;
  onCancel: () => void;
  defaultPhone?: string;
  defaultEmail?: string;
}

// API Function
async function createBooking(data: CreateVisitBooking): Promise<any> {
  const res = await fetch("/api/visit-scheduling/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erreur lors de la réservation");
  }

  return res.json();
}

export function BookingForm({
  slot,
  property,
  onSuccess,
  onCancel,
  defaultPhone,
  defaultEmail,
}: BookingFormProps) {
  const form = useForm<CreateVisitBooking>({
    resolver: zodResolver(createVisitBookingSchema),
    defaultValues: {
      slot_id: slot.id,
      tenant_message: "",
      contact_phone: defaultPhone || "",
      contact_email: defaultEmail || "",
      party_size: 1,
    },
  });

  const mutation = useMutation({
    mutationFn: createBooking,
    onSuccess: (data) => {
      onSuccess(data.booking);
    },
  });

  const onSubmit = (data: CreateVisitBooking) => {
    mutation.mutate(data);
  };

  // Format time string (HH:mm:ss or HH:mm)
  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5);
  };

  // Format date string (YYYY-MM-DD)
  const formatDate = (dateString: string) => {
    const date = parse(dateString, "yyyy-MM-dd", new Date());
    return format(date, "EEEE d MMMM yyyy", { locale: fr });
  };

  const maxPartySize = slot.max_visitors - slot.current_visitors;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Confirmer la réservation
        </CardTitle>
        <CardDescription>
          Vérifiez les détails et complétez votre réservation
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Slot Summary */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">{property.adresse_complete}</p>
              <p className="text-sm text-muted-foreground">
                {property.code_postal} {property.ville}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium capitalize">{formatDate(slot.slot_date)}</p>
              <p className="text-sm text-muted-foreground">
                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {mutation.error?.message || "Une erreur est survenue"}
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Contact Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Téléphone
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+33 6 12 34 56 78"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Pour vous contacter en cas de changement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="vous@exemple.com"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Pour recevoir la confirmation
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Party Size */}
            {maxPartySize > 1 && (
              <FormField
                control={form.control}
                name="party_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nombre de personnes
                    </FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: Math.min(maxPartySize, 5) }, (_, i) => i + 1).map(
                          (n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} personne{n > 1 ? "s" : ""}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Message */}
            <FormField
              control={form.control}
              name="tenant_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Présentez-vous brièvement ou posez une question au propriétaire..."
                      className="min-h-[100px] resize-none"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Ce message sera envoyé au propriétaire
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Retour
        </Button>
        <Button
          onClick={form.handleSubmit(onSubmit)}
          disabled={mutation.isPending}
        >
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Confirmer la visite
        </Button>
      </CardFooter>
    </Card>
  );
}

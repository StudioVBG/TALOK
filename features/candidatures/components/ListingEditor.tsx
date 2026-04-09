"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { createListingSchema, type CreateListingInput } from "@/lib/validations/candidatures";
import { BAIL_TYPE_LABELS } from "@/lib/types/candidatures";

interface ListingEditorProps {
  propertyId: string;
  onSubmit: (data: CreateListingInput) => void;
  isLoading?: boolean;
  defaultValues?: Partial<CreateListingInput>;
}

export function ListingEditor({ propertyId, onSubmit, isLoading, defaultValues }: ListingEditorProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateListingInput>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      property_id: propertyId,
      charges_cents: 0,
      bail_type: 'meuble',
      ...defaultValues,
    },
  });

  const bailType = watch("bail_type");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer une annonce</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <input type="hidden" {...register("property_id")} />

          <div className="space-y-2">
            <Label htmlFor="title">Titre de l'annonce *</Label>
            <Input
              id="title"
              placeholder="Appartement lumineux 3 pièces - Centre-ville"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Décrivez votre bien en détail : atouts, quartier, transports..."
              rows={5}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rent_amount_cents">Loyer mensuel (en centimes) *</Label>
              <Input
                id="rent_amount_cents"
                type="number"
                min={0}
                placeholder="75000"
                {...register("rent_amount_cents", { valueAsNumber: true })}
              />
              {errors.rent_amount_cents && (
                <p className="text-sm text-red-500">{errors.rent_amount_cents.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Entrez en centimes (ex: 75000 = 750,00 EUR)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="charges_cents">Charges (en centimes)</Label>
              <Input
                id="charges_cents"
                type="number"
                min={0}
                placeholder="5000"
                {...register("charges_cents", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="available_from">Date de disponibilité *</Label>
              <Input
                id="available_from"
                type="date"
                {...register("available_from")}
              />
              {errors.available_from && (
                <p className="text-sm text-red-500">{errors.available_from.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type de bail *</Label>
              <Select
                value={bailType}
                onValueChange={(value) => setValue("bail_type", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type de bail" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BAIL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer l'annonce
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

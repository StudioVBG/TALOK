"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INSURANCE_TYPES } from "@/lib/insurance/types";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance/constants";
import type { InsurancePolicyInsert, InsurancePolicyWithExpiry } from "@/lib/insurance/types";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  insurance_type: z.enum(INSURANCE_TYPES),
  insurer_name: z.string().min(1, "Nom de l'assureur requis"),
  policy_number: z.string().optional(),
  start_date: z.string().min(1, "Date de debut requise"),
  end_date: z.string().min(1, "Date de fin requise"),
  amount_covered_cents: z.string().optional(),
  property_id: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface InsuranceFormProps {
  onSubmit: (data: InsurancePolicyInsert) => Promise<void>;
  initialData?: InsurancePolicyWithExpiry | null;
  properties?: { id: string; adresse_complete: string }[];
  profileId: string;
  isLoading?: boolean;
  onCancel?: () => void;
}

export function InsuranceForm({
  onSubmit,
  initialData,
  properties,
  profileId,
  isLoading,
  onCancel,
}: InsuranceFormProps) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      insurance_type: initialData?.insurance_type || "pno",
      insurer_name: initialData?.insurer_name || "",
      policy_number: initialData?.policy_number || "",
      start_date: initialData?.start_date || "",
      end_date: initialData?.end_date || "",
      amount_covered_cents: initialData?.amount_covered_cents
        ? String(initialData.amount_covered_cents / 100)
        : "",
      property_id: initialData?.property_id || "",
    },
  });

  const selectedType = watch("insurance_type");

  async function onFormSubmit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        profile_id: profileId,
        insurance_type: values.insurance_type,
        insurer_name: values.insurer_name,
        policy_number: values.policy_number || null,
        start_date: values.start_date,
        end_date: values.end_date,
        amount_covered_cents: values.amount_covered_cents
          ? Math.round(parseFloat(values.amount_covered_cents) * 100)
          : null,
        property_id: values.property_id || null,
        lease_id: initialData?.lease_id || null,
        document_id: initialData?.document_id || null,
      });
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    }
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label>Type d&apos;assurance</Label>
        <Select
          value={selectedType}
          onValueChange={(val: string) => setValue("insurance_type", val as typeof selectedType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choisir le type" />
          </SelectTrigger>
          <SelectContent>
            {INSURANCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {INSURANCE_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.insurance_type && (
          <p className="text-sm text-red-500">{errors.insurance_type.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="insurer_name">Assureur</Label>
        <Input
          id="insurer_name"
          placeholder="Ex: MAIF, AXA, Allianz..."
          {...register("insurer_name")}
        />
        {errors.insurer_name && (
          <p className="text-sm text-red-500">{errors.insurer_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="policy_number">N° de contrat (optionnel)</Label>
        <Input
          id="policy_number"
          placeholder="Ex: HAB-2024-123456"
          {...register("policy_number")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Date de debut</Label>
          <Input id="start_date" type="date" {...register("start_date")} />
          {errors.start_date && (
            <p className="text-sm text-red-500">{errors.start_date.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">Date de fin</Label>
          <Input id="end_date" type="date" {...register("end_date")} />
          {errors.end_date && (
            <p className="text-sm text-red-500">{errors.end_date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount_covered_cents">Montant couvert (optionnel)</Label>
        <Input
          id="amount_covered_cents"
          type="number"
          step="0.01"
          placeholder="Ex: 500000"
          {...register("amount_covered_cents")}
        />
      </div>

      {properties && properties.length > 0 && (
        <div className="space-y-2">
          <Label>Bien associe (optionnel)</Label>
          <Select
            value={watch("property_id") || ""}
            onValueChange={(val: string) => setValue("property_id", val === "none" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Aucun bien specifique" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun bien specifique</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.adresse_complete}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {initialData ? "Modifier" : "Ajouter l'assurance"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}

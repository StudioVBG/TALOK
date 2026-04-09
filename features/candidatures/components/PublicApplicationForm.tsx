"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Loader2, Send } from "lucide-react";
import { createApplicationSchema, type CreateApplicationInput } from "@/lib/validations/candidatures";

interface PublicApplicationFormProps {
  listingId: string;
  listingTitle: string;
  onSubmit: (data: CreateApplicationInput) => Promise<void>;
}

export function PublicApplicationForm({
  listingId,
  listingTitle,
  onSubmit,
}: PublicApplicationFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateApplicationInput>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues: {
      listing_id: listingId,
    },
  });

  const handleFormSubmit = async (data: CreateApplicationInput) => {
    setError(null);
    try {
      await onSubmit(data);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    }
  };

  if (submitted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Candidature envoyée</h3>
          <p className="text-muted-foreground max-w-md">
            Votre candidature a bien été enregistrée. Le propriétaire examinera votre dossier
            et vous contactera dans les meilleurs délais.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Déposer ma candidature</CardTitle>
        <CardDescription>
          Pour le logement : {listingTitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          <input type="hidden" {...register("listing_id")} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="applicant_name">Nom complet *</Label>
              <Input
                id="applicant_name"
                placeholder="Jean Dupont"
                {...register("applicant_name")}
              />
              {errors.applicant_name && (
                <p className="text-sm text-red-500">{errors.applicant_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicant_email">Email *</Label>
              <Input
                id="applicant_email"
                type="email"
                placeholder="jean.dupont@email.com"
                {...register("applicant_email")}
              />
              {errors.applicant_email && (
                <p className="text-sm text-red-500">{errors.applicant_email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="applicant_phone">Téléphone</Label>
            <Input
              id="applicant_phone"
              type="tel"
              placeholder="06 12 34 56 78"
              {...register("applicant_phone")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message au propriétaire</Label>
            <Textarea
              id="message"
              placeholder="Présentez-vous brièvement : situation professionnelle, motivations..."
              rows={4}
              {...register("message")}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer ma candidature
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            En soumettant ce formulaire, vous acceptez que vos données soient traitées
            conformément à notre politique de confidentialité. Vos données seront supprimées
            automatiquement 6 mois après le refus éventuel de votre candidature.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

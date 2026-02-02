"use client";

import { useForm, UseFormProps, UseFormReturn, FieldValues, Path, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZodSchema, ZodError } from "zod";
import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";

interface UseFormWithValidationOptions<T extends FieldValues> extends Omit<UseFormProps<T>, "resolver"> {
  schema: ZodSchema<T>;
  onSubmit: (data: T) => Promise<void> | void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseFormWithValidationReturn<T extends FieldValues> extends UseFormReturn<T> {
  isSubmitting: boolean;
  submitError: string | null;
  handleFormSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  clearSubmitError: () => void;
}

/**
 * Hook personnalisé pour les formulaires avec validation Zod intégrée
 * 
 * @example
 * const form = useFormWithValidation({
 *   schema: propertySchema,
 *   defaultValues: { type: "appartement" },
 *   onSubmit: async (data) => {
 *     await createProperty(data);
 *   },
 *   successMessage: "Propriété créée avec succès",
 * });
 * 
 * return (
 *   <form onSubmit={form.handleFormSubmit}>
 *     <Input {...form.register("adresse_complete")} />
 *     {form.formState.errors.adresse_complete && (
 *       <p>{form.formState.errors.adresse_complete.message}</p>
 *     )}
 *     <Button type="submit" disabled={form.isSubmitting}>
 *       {form.isSubmitting ? "Enregistrement..." : "Enregistrer"}
 *     </Button>
 *   </form>
 * );
 */
export function useFormWithValidation<T extends FieldValues>({
  schema,
  onSubmit,
  onError,
  successMessage = "Enregistré avec succès",
  errorMessage = "Une erreur est survenue",
  ...formOptions
}: UseFormWithValidationOptions<T>): UseFormWithValidationReturn<T> {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    mode: "onBlur", // Validation au blur pour une meilleure UX
    ...formOptions,
  });

  const clearSubmitError = useCallback(() => {
    setSubmitError(null);
  }, []);

  const handleFormSubmit: SubmitHandler<T> = useCallback(
    async (data) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await onSubmit(data);
        toast({
          title: "Succès",
          description: successMessage,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : errorMessage;
        setSubmitError(message);
        
        toast({
          title: "Erreur",
          description: message,
          variant: "destructive",
        });

        if (onError) {
          onError(error as Error);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [onSubmit, onError, successMessage, errorMessage, toast]
  );

  return {
    ...form,
    isSubmitting,
    submitError,
    handleFormSubmit: form.handleSubmit(handleFormSubmit),
    clearSubmitError,
  };
}

/**
 * Hook pour validation côté serveur avec Zod
 */
export function useServerValidation<T extends FieldValues>(schema: ZodSchema<T>) {
  const validate = useCallback(
    (data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } => {
      try {
        const validData = schema.parse(data);
        return { success: true, data: validData };
      } catch (error) {
        if (error instanceof ZodError) {
          const errors: Record<string, string> = {};
          error.errors.forEach((err) => {
            const path = err.path.join(".");
            errors[path] = err.message;
          });
          return { success: false, errors };
        }
        return { success: false, errors: { _root: "Erreur de validation inconnue" } };
      }
    },
    [schema]
  );

  const validateField = useCallback(
    (field: Path<T>, value: unknown): string | null => {
      try {
        // Créer un objet partiel pour la validation
        const partialData = { [field]: value } as Partial<T>;
        (schema as any).pick({ [field]: true }).parse(partialData);
        return null;
      } catch (error) {
        if (error instanceof ZodError) {
          return error.errors[0]?.message || "Valeur invalide";
        }
        return null;
      }
    },
    [schema]
  );

  return { validate, validateField };
}

/**
 * Hook pour gérer les erreurs de formulaire API
 */
export function useFormApiErrors<T extends FieldValues>(form: UseFormReturn<T>) {
  const setApiErrors = useCallback(
    (errors: Record<string, string | string[]>) => {
      Object.entries(errors).forEach(([field, message]) => {
        const errorMessage = Array.isArray(message) ? message[0] : message;
        form.setError(field as Path<T>, {
          type: "server",
          message: errorMessage,
        });
      });
    },
    [form]
  );

  const clearApiErrors = useCallback(() => {
    form.clearErrors();
  }, [form]);

  return { setApiErrors, clearApiErrors };
}

export default useFormWithValidation;


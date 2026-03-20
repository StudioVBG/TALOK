import { z } from "zod";
import { passwordSchema } from "@/lib/validations/onboarding";

export const passwordRecoveryRequestSchema = z.object({
  email: z.string().email("Email invalide").transform((value) => value.trim().toLowerCase()),
});

export const passwordRecoveryCompleteSchema = z
  .object({
    token: z.string().min(1, "Token de réinitialisation requis"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export type PasswordRecoveryRequestInput = z.infer<typeof passwordRecoveryRequestSchema>;
export type PasswordRecoveryCompleteInput = z.infer<typeof passwordRecoveryCompleteSchema>;

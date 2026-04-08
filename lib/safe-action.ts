/**
 * Client next-safe-action centralise pour Talok
 *
 * Fournit des Server Actions type-safe avec :
 * - Validation Zod automatique
 * - Authentification Supabase integree
 * - Gestion d'erreurs centralisee (Sentry)
 * - Context utilisateur injecte automatiquement
 *
 * Usage :
 * ```ts
 * export const myAction = authAction
 *   .schema(z.object({ id: z.string().uuid() }))
 *   .action(async ({ parsedInput, ctx }) => {
 *     // ctx.user, ctx.supabase disponibles
 *     return { success: true };
 *   });
 * ```
 */

import { createSafeActionClient } from "next-safe-action";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Client de base (sans auth)
// =============================================================================

export const publicAction = createSafeActionClient({
  handleServerError(e) {
    // Log vers Sentry en production
    if (process.env.NODE_ENV === "production") {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(e);
      });
    }
    console.error("[safe-action] Server error:", e.message);
    return e.message;
  },
});

// =============================================================================
// Client authentifie (injecte user + supabase dans le contexte)
// =============================================================================

export const authAction = publicAction.use(async ({ next }) => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Non authentifié");
  }

  // Recuperer le profil pour le role
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    throw new Error("Profil introuvable");
  }

  return next({
    ctx: {
      supabase,
      user,
      profile: {
        id: profile.id as string,
        role: profile.role as string,
      },
    },
  });
});

// =============================================================================
// Client owner-only
// =============================================================================

export const ownerAction = authAction.use(async ({ next, ctx }) => {
  if (ctx.profile.role !== "owner" && ctx.profile.role !== "admin") {
    throw new Error("Accès réservé aux propriétaires");
  }
  return next({ ctx });
});

// =============================================================================
// Client admin-only
// =============================================================================

export const adminAction = authAction.use(async ({ next, ctx }) => {
  if (ctx.profile.role !== "admin" && ctx.profile.role !== "platform_admin") {
    throw new Error("Accès réservé aux administrateurs");
  }
  return next({ ctx });
});

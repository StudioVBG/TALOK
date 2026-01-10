/**
 * GET /api/csrf - Obtenir un token CSRF
 *
 * Ce endpoint doit être appelé au chargement de l'application
 * pour obtenir un token CSRF valide.
 */

import { getCsrfTokenHandler } from "@/lib/middleware/csrf";

export const dynamic = "force-dynamic";

export async function GET() {
  return getCsrfTokenHandler();
}

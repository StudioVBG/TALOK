export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronRight,
  Leaf,
  Sparkles,
  Truck,
  PaintBucket,
  Hammer,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  TENANT_BOOKABLE_CATEGORIES,
  TENANT_BOOKABLE_CATEGORY_LABELS,
  normalizePermissions,
  type TenantBookableCategory,
} from "@/lib/tickets/tenant-service-permissions";

const CATEGORY_META: Record<
  TenantBookableCategory,
  { icon: typeof Leaf; tagline: string; bg: string; fg: string }
> = {
  jardinage: {
    icon: Leaf,
    tagline: "Tonte, taille, entretien des espaces verts",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    fg: "text-emerald-600 dark:text-emerald-400",
  },
  nettoyage: {
    icon: Sparkles,
    tagline: "Ménage ponctuel, grand nettoyage, vitres",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    fg: "text-sky-600 dark:text-sky-400",
  },
  demenagement: {
    icon: Truck,
    tagline: "Manutention, transport, aide au déménagement",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    fg: "text-amber-600 dark:text-amber-400",
  },
  peinture: {
    icon: PaintBucket,
    tagline: "Rafraîchissement des murs, retouches",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    fg: "text-fuchsia-600 dark:text-fuchsia-400",
  },
  petits_travaux: {
    icon: Hammer,
    tagline: "Montage, fixations, petits bricolages",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    fg: "text-indigo-600 dark:text-indigo-400",
  },
};

interface AggregatedPermissions {
  anyEnabled: boolean;
  allowedCategories: Set<string>;
  requiresOwnerApproval: boolean;
}

async function loadPermissions(): Promise<AggregatedPermissions | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return null;
  const profileData = profile as { id: string; email: string | null };
  const email = profileData.email ?? user.email ?? null;

  const leaseIds = new Set<string>();
  const { data: byProfile } = await serviceClient
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profileData.id)
    .in("role", ["locataire_principal", "colocataire"]);
  for (const s of byProfile || []) leaseIds.add((s as { lease_id: string }).lease_id);

  if (email) {
    const { data: byEmail } = await serviceClient
      .from("lease_signers")
      .select("lease_id")
      .ilike("invited_email", email)
      .in("role", ["locataire_principal", "colocataire"]);
    for (const s of byEmail || []) leaseIds.add((s as { lease_id: string }).lease_id);
  }

  if (leaseIds.size === 0) {
    return { anyEnabled: false, allowedCategories: new Set(), requiresOwnerApproval: false };
  }

  const { data: leases } = await serviceClient
    .from("leases")
    .select("tenant_service_bookings, statut")
    .in("id", Array.from(leaseIds))
    .in("statut", ["active", "fully_signed"]);

  const allowed = new Set<string>();
  let anyEnabled = false;
  let requiresApproval = false;

  for (const lease of (leases || []) as Array<{ tenant_service_bookings: any }>) {
    const perms = normalizePermissions(lease.tenant_service_bookings);
    if (perms.enabled) {
      anyEnabled = true;
      if (perms.requires_owner_approval) requiresApproval = true;
      for (const cat of perms.allowed_categories) allowed.add(cat);
    }
  }

  return { anyEnabled, allowedCategories: allowed, requiresOwnerApproval: requiresApproval };
}

export default async function TenantServicesPage() {
  const perms = await loadPermissions();
  if (!perms) redirect("/auth/signin?redirect=/tenant/services");

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Réserver un service
          </h1>
        </div>
        <p className="text-muted-foreground">
          Accédez à des prestataires de confiance sélectionnés par votre propriétaire.
        </p>
      </div>

      {!perms.anyEnabled ? (
        <Card className="bg-card border border-border">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Service non activé</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Votre propriétaire n'a pas (encore) activé la réservation directe de
              prestataires. Contactez-le ou créez une demande classique via votre
              espace « Mes demandes ».
            </p>
            <Button asChild variant="outline">
              <Link href="/tenant/requests/new">Créer une demande classique</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {perms.requiresOwnerApproval && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900 dark:text-amber-200">
                Votre propriétaire doit valider chaque réservation avant que le
                prestataire intervienne. Vous serez notifié dès la validation.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(TENANT_BOOKABLE_CATEGORIES as readonly TenantBookableCategory[]).map(
              (category) => {
                const meta = CATEGORY_META[category];
                const Icon = meta.icon;
                const allowed = perms.allowedCategories.has(category);
                return (
                  <Card
                    key={category}
                    className={`border border-border transition-all ${allowed ? "hover:shadow-md cursor-pointer" : "opacity-60"}`}
                  >
                    <Link
                      href={allowed ? `/tenant/services/${category}` : "#"}
                      aria-disabled={!allowed}
                      className={allowed ? "" : "pointer-events-none"}
                    >
                      <CardContent className="p-6 flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${meta.bg}`}>
                          <Icon className={`h-6 w-6 ${meta.fg}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground">
                            {TENANT_BOOKABLE_CATEGORY_LABELS[category]}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {meta.tagline}
                          </p>
                          {!allowed && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Non activé par votre propriétaire
                            </p>
                          )}
                        </div>
                        {allowed && (
                          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                      </CardContent>
                    </Link>
                  </Card>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
}

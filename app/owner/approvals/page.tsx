export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, CheckCircle2, ChevronLeft, ClipboardCheck, Info, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TENANT_BOOKABLE_CATEGORY_LABELS } from "@/lib/tickets/tenant-service-permissions";
import { OwnerApprovalActions } from "./OwnerApprovalActions";

interface PendingBooking {
  work_order_id: string;
  ticket_id: string | null;
  ticket_reference: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  preferred_date: string | null;
  created_at: string;
  property_address: string | null;
  tenant_name: string | null;
  provider_company: string | null;
}

export default async function OwnerApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin?redirect=/owner/approvals");

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/auth/signin");
  const profileData = profile as { id: string; role: string };

  const { data: properties } = await serviceClient
    .from("properties")
    .select("id, adresse_complete, ville, code_postal")
    .eq("owner_id", profileData.id);

  const propertyMap = new Map<
    string,
    { address: string }
  >();
  for (const p of (properties || []) as Array<{
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
  }>) {
    propertyMap.set(p.id, {
      address: `${p.adresse_complete}, ${p.code_postal} ${p.ville}`,
    });
  }

  const propertyIds = Array.from(propertyMap.keys());

  let bookings: PendingBooking[] = [];
  if (propertyIds.length > 0) {
    const { data: workOrders } = await serviceClient
      .from("work_orders")
      .select(
        `id, ticket_id, property_id, title, description, category,
         date_intervention_prevue, created_at, provider_id`
      )
      .in("property_id", propertyIds)
      .eq("owner_approval_status", "pending")
      .eq("requester_role", "tenant")
      .order("created_at", { ascending: false });

    const rows = (workOrders || []) as Array<{
      id: string;
      ticket_id: string | null;
      property_id: string;
      title: string | null;
      description: string | null;
      category: string | null;
      date_intervention_prevue: string | null;
      created_at: string;
      provider_id: string | null;
    }>;

    // Résoudre ticket reference + tenant name + provider company en batch
    const ticketIds = rows.map((r) => r.ticket_id).filter((x): x is string => !!x);
    const providerIds = rows.map((r) => r.provider_id).filter((x): x is string => !!x);

    const [ticketsRes, providersRes] = await Promise.all([
      ticketIds.length
        ? serviceClient
            .from("tickets")
            .select(
              "id, reference, created_by_profile_id, creator:profiles!created_by_profile_id(prenom, nom)"
            )
            .in("id", ticketIds)
        : Promise.resolve({ data: [] as any[] }),
      providerIds.length
        ? serviceClient
            .from("providers")
            .select("profile_id, company_name")
            .in("profile_id", providerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const ticketMap = new Map<string, { reference: string | null; tenant_name: string | null }>();
    for (const t of (ticketsRes.data || []) as any[]) {
      const creator = Array.isArray(t.creator) ? t.creator[0] : t.creator;
      const name = creator
        ? `${creator.prenom ?? ""} ${creator.nom ?? ""}`.trim()
        : null;
      ticketMap.set(t.id, { reference: t.reference ?? null, tenant_name: name || null });
    }

    const providerMap = new Map<string, string>();
    for (const p of (providersRes.data || []) as any[]) {
      if (p.profile_id) providerMap.set(p.profile_id, p.company_name);
    }

    bookings = rows.map((r) => ({
      work_order_id: r.id,
      ticket_id: r.ticket_id,
      ticket_reference: r.ticket_id
        ? ticketMap.get(r.ticket_id)?.reference ?? null
        : null,
      title: r.title,
      description: r.description,
      category: r.category,
      preferred_date: r.date_intervention_prevue,
      created_at: r.created_at,
      property_address: propertyMap.get(r.property_id)?.address ?? null,
      tenant_name: r.ticket_id ? ticketMap.get(r.ticket_id)?.tenant_name ?? null : null,
      provider_company: r.provider_id ? providerMap.get(r.provider_id) ?? null : null,
    }));
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <Link
        href="/owner/tickets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux tickets
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-lg shadow-lg shadow-amber-200 dark:shadow-amber-900/30">
            <ClipboardCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Validations en attente
          </h1>
        </div>
        <p className="text-muted-foreground">
          Réservations de services initiées par vos locataires. Validez pour
          notifier le prestataire, ou refusez en expliquant la raison.
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <p className="text-muted-foreground">
              Aucune réservation en attente pour le moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Card key={b.work_order_id} className="border border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.ticket_reference && (
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          {b.ticket_reference}
                        </span>
                      )}
                      {b.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {TENANT_BOOKABLE_CATEGORY_LABELS[
                            b.category as keyof typeof TENANT_BOOKABLE_CATEGORY_LABELS
                          ] || b.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(b.created_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">
                      {b.title || "Réservation sans titre"}
                    </h3>
                    {b.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {b.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-2">
                      {b.tenant_name && (
                        <span>Demandé par <strong>{b.tenant_name}</strong></span>
                      )}
                      {b.provider_company && (
                        <span>→ <strong>{b.provider_company}</strong></span>
                      )}
                      {b.property_address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {b.property_address}
                        </span>
                      )}
                      {b.preferred_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Souhaité le {format(new Date(b.preferred_date), "d MMM yyyy", { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <OwnerApprovalActions workOrderId={b.work_order_id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Pour désactiver la validation systématique, allez sur le bail
          concerné (<em>Services réservables</em>) et décochez « Valider
          chaque réservation ».
        </p>
      </div>
    </div>
  );
}

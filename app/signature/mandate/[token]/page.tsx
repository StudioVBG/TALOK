export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/supabase/service-client";
import { logger } from "@/lib/monitoring";
import { MandateSignatureFlow } from "./MandateSignatureFlow";

interface PageProps {
  params: Promise<{ token: string }>;
}

const TOKEN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

async function getMandateByToken(token: string) {
  if (!token || token.length < 16) {
    return { error: "invalid" as const };
  }

  const serviceClient = getServiceClient();

  const { data: mandate, error } = await serviceClient
    .from("agency_mandates")
    .select(
      `
      id,
      mandate_number,
      mandate_type,
      start_date,
      end_date,
      tacit_renewal,
      management_fee_type,
      management_fee_rate,
      management_fee_fixed_cents,
      property_ids,
      status,
      signature_status,
      signature_sent_at,
      signature_completed_at,
      agency:profiles!agency_mandates_agency_profile_id_fkey(
        id, prenom, nom, email
      ),
      owner:profiles!agency_mandates_owner_profile_id_fkey(
        id, prenom, nom, email
      ),
      agency_entity:legal_entities!agency_mandates_agency_entity_id_fkey(
        id, raison_sociale, siret, adresse
      )
    `,
    )
    .eq("signature_token", token)
    .maybeSingle();

  if (error) {
    logger.error("[mandate-signature] DB error", { error, token: token.slice(0, 8) });
    return { error: "db" as const };
  }

  if (!mandate) {
    return { error: "invalid" as const };
  }

  // Déjà signé ?
  if (mandate.signature_status === "signed") {
    return { error: "already_signed" as const, mandate };
  }

  if (mandate.signature_status === "refused") {
    return { error: "refused" as const, mandate };
  }

  // Expiration : sent_at + 30 jours
  if (mandate.signature_sent_at) {
    const sentAt = new Date(mandate.signature_sent_at).getTime();
    if (Date.now() - sentAt > TOKEN_VALIDITY_MS) {
      return { error: "expired" as const, mandate };
    }
  }

  if (mandate.signature_status !== "pending") {
    return { error: "invalid_state" as const, mandate };
  }

  return { mandate };
}

export default async function MandateSignaturePage({ params }: PageProps) {
  const { token } = await params;
  const result = await getMandateByToken(token);

  if (result.error === "invalid" || result.error === "db") {
    return (
      <ErrorScreen
        emoji="🔗"
        title="Lien invalide"
        message="Ce lien de signature n'existe pas ou a déjà été utilisé. Contactez votre agence pour recevoir une nouvelle invitation."
      />
    );
  }

  if (result.error === "expired") {
    return (
      <ErrorScreen
        emoji="⏰"
        title="Lien expiré"
        message="Ce lien a expiré (validité 30 jours). Contactez votre agence pour recevoir une nouvelle invitation."
      />
    );
  }

  if (result.error === "already_signed") {
    return (
      <ErrorScreen
        emoji="✅"
        title="Mandat déjà signé"
        message="Vous avez déjà signé ce mandat. Vous pouvez consulter votre espace propriétaire pour suivre sa gestion."
        success
      />
    );
  }

  if (result.error === "refused") {
    return (
      <ErrorScreen
        emoji="❌"
        title="Mandat refusé"
        message="Vous avez refusé ce mandat. Si c'est une erreur, contactez votre agence."
      />
    );
  }

  if (result.error === "invalid_state") {
    return (
      <ErrorScreen
        emoji="⚠️"
        title="Mandat indisponible"
        message="Ce mandat n'est pas en attente de signature."
      />
    );
  }

  return <MandateSignatureFlow token={token} mandate={result.mandate as any} />;
}

function ErrorScreen({
  emoji,
  title,
  message,
  success,
}: {
  emoji: string;
  title: string;
  message: string;
  success?: boolean;
}) {
  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${
        success
          ? "from-green-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900"
          : "from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900"
      } p-4`}
    >
      <div className="text-center p-8 max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
        <div className="text-6xl mb-4">{emoji}</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Signer votre mandat | Talok",
  description: "Acceptez et signez votre mandat de gestion locative",
};

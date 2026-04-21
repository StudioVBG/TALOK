"use client";

import { Info, Receipt } from "lucide-react";

interface Props {
  /** État courant de la classification côté serveur */
  is_tenant_chargeable: boolean | null | undefined;
  charge_category_code: string | null | undefined;
  /** Statut du ticket pour adapter le message */
  ticketStatus?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  ascenseurs: "Ascenseurs",
  eau_chauffage: "Eau & chauffage",
  installations_individuelles: "Installations individuelles",
  parties_communes: "Parties communes",
  espaces_exterieurs: "Espaces extérieurs",
  taxes_redevances: "Taxes & redevances",
};

/**
 * Bloc informatif côté locataire : explique si le coût de l'intervention
 * lui sera refacturé (via régularisation annuelle) ou reste à la charge
 * du propriétaire.
 *
 * Volontairement neutre quand la décision n'est pas prise (null) — on
 * évite de spéculer sur ce que le propriétaire va faire.
 */
export function TicketChargesTenantBadge({
  is_tenant_chargeable,
  charge_category_code,
  ticketStatus,
}: Props) {
  // Cas ambigu : on n'affiche rien pour ne pas induire en erreur
  if (is_tenant_chargeable === null || is_tenant_chargeable === undefined) {
    return null;
  }

  if (is_tenant_chargeable === false) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
        <Info className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            À la charge du propriétaire
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
            Vous n'aurez rien à payer pour cette intervention.
          </p>
        </div>
      </div>
    );
  }

  // is_tenant_chargeable === true
  const categoryLabel = charge_category_code
    ? CATEGORY_LABELS[charge_category_code] ?? charge_category_code
    : null;
  const isResolved = ticketStatus === "resolved" || ticketStatus === "closed";

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
      <Receipt className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {isResolved
            ? "Ajouté à vos charges récupérables"
            : "Sera refacturé sur vos charges"}
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
          {isResolved
            ? "Ce montant apparaîtra sur votre prochaine régularisation annuelle des charges."
            : "Une fois l'intervention terminée et payée, le coût sera intégré à votre régularisation annuelle."}
          {categoryLabel && (
            <>
              {" "}
              Catégorie : <strong>{categoryLabel}</strong>
              {" "}
              (décret 87-713).
            </>
          )}
        </p>
      </div>
    </div>
  );
}

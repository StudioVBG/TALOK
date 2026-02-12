/**
 * Service de relance impayés — SOTA 2026
 *
 * Workflow graduel :
 *  1. Relance amiable (J+5 après échéance) → email de rappel
 *  2. Relance formelle (J+15)              → email recommandé
 *  3. Mise en demeure (J+30)               → email + courrier recommandé
 *
 * Ce service ne modifie PAS le schéma existant.
 * Il s'appuie sur : invoices (statut, due_date), leases, profiles.
 */

export type ReminderLevel = "amiable" | "formelle" | "mise_en_demeure";

export interface LateInvoice {
  id: string;
  lease_id: string;
  montant: number;
  due_date: string;
  days_late: number;
  reminder_level: ReminderLevel;
  tenant_name: string;
  tenant_email: string | null;
  property_address: string;
  lease_type: string;
}

export interface ReminderResult {
  invoice_id: string;
  level: ReminderLevel;
  sent: boolean;
  error?: string;
}

/**
 * Calcule le niveau de relance selon le nombre de jours de retard.
 */
export function getReminderLevel(daysLate: number): ReminderLevel {
  if (daysLate >= 30) return "mise_en_demeure";
  if (daysLate >= 15) return "formelle";
  return "amiable";
}

/**
 * Génère le sujet et le corps de l'email de relance selon le niveau.
 */
export function getReminderEmailContent(
  level: ReminderLevel,
  invoice: LateInvoice
): { subject: string; body: string } {
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(invoice.montant);
  const dueDate = new Date(invoice.due_date).toLocaleDateString("fr-FR");

  switch (level) {
    case "amiable":
      return {
        subject: `Rappel : Loyer en attente pour ${invoice.property_address}`,
        body: [
          `Bonjour ${invoice.tenant_name},`,
          ``,
          `Nous nous permettons de vous rappeler que votre loyer de ${amount}, `,
          `échu le ${dueDate}, n'a pas encore été réglé.`,
          ``,
          `Il peut s'agir d'un oubli. Nous vous invitons à régulariser votre situation `,
          `dans les meilleurs délais.`,
          ``,
          `Cordialement,`,
          `Votre propriétaire via TALOK`,
        ].join("\n"),
      };

    case "formelle":
      return {
        subject: `Relance : Impayé de loyer — ${invoice.property_address}`,
        body: [
          `Bonjour ${invoice.tenant_name},`,
          ``,
          `Malgré notre précédent rappel, nous constatons que le loyer de ${amount}, `,
          `échu le ${dueDate} (soit ${invoice.days_late} jours de retard), `,
          `reste impayé.`,
          ``,
          `Nous vous demandons de bien vouloir procéder au règlement dans un délai de 8 jours.`,
          ``,
          `À défaut, nous nous verrons dans l'obligation d'engager les démarches `,
          `prévues par la loi.`,
          ``,
          `Cordialement,`,
          `Votre propriétaire via TALOK`,
        ].join("\n"),
      };

    case "mise_en_demeure":
      return {
        subject: `MISE EN DEMEURE — Impayé de loyer ${invoice.property_address}`,
        body: [
          `Bonjour ${invoice.tenant_name},`,
          ``,
          `Par la présente, nous vous mettons en demeure de régler la somme de ${amount}, `,
          `correspondant au loyer échu le ${dueDate} `,
          `(soit ${invoice.days_late} jours de retard).`,
          ``,
          `Conformément à l'article 24 de la loi n°89-462 du 6 juillet 1989, `,
          `à défaut de paiement dans un délai de 2 mois à compter de la réception `,
          `de la présente mise en demeure, nous serons contraints de saisir `,
          `la commission de surendettement et/ou d'engager une procédure judiciaire.`,
          ``,
          `Nous vous rappelons que les frais de procédure seront à votre charge.`,
          ``,
          `Nous restons à votre disposition pour convenir d'un échéancier de paiement.`,
          ``,
          `Cordialement,`,
          `Votre propriétaire via TALOK`,
        ].join("\n"),
      };
  }
}

/**
 * Détermine les factures en retard à partir des données brutes.
 * Utilise uniquement des données déjà disponibles (invoices + leases + signers).
 */
export function detectLateInvoices(
  invoices: Array<{
    id: string;
    lease_id: string;
    montant: number;
    due_date: string;
    statut: string;
  }>,
  leases: Array<{
    id: string;
    type_bail: string;
    property?: { adresse_complete?: string } | null;
  }>,
  signersMap: Record<string, Array<{
    role: string;
    profile?: { prenom?: string; nom?: string; email?: string } | null;
  }>>,
  now: Date = new Date()
): LateInvoice[] {
  const result: LateInvoice[] = [];

  for (const inv of invoices) {
    // Seules les factures non payées avec une date d'échéance passée
    if (inv.statut === "paid" || inv.statut === "succeeded") continue;
    if (!inv.due_date) continue;

    const dueDate = new Date(inv.due_date);
    const diffMs = now.getTime() - dueDate.getTime();
    const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Seuil minimum : 5 jours de retard pour la 1re relance
    if (daysLate < 5) continue;

    const lease = leases.find(l => l.id === inv.lease_id);
    const signers = signersMap[inv.lease_id] || [];
    const tenantSigner = signers.find(s =>
      ["locataire_principal", "colocataire", "locataire"].includes(s.role)
    );
    const tenantName = tenantSigner?.profile
      ? `${tenantSigner.profile.prenom || ""} ${tenantSigner.profile.nom || ""}`.trim()
      : "Locataire";
    const tenantEmail = tenantSigner?.profile?.email || null;

    result.push({
      id: inv.id,
      lease_id: inv.lease_id,
      montant: inv.montant,
      due_date: inv.due_date,
      days_late: daysLate,
      reminder_level: getReminderLevel(daysLate),
      tenant_name: tenantName,
      tenant_email: tenantEmail,
      property_address: lease?.property?.adresse_complete || "Adresse inconnue",
      lease_type: lease?.type_bail || "nu",
    });
  }

  // Trier par nombre de jours de retard décroissant (plus urgent en premier)
  result.sort((a, b) => b.days_late - a.days_late);

  return result;
}

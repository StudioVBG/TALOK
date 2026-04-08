/**
 * Email template: copro-overdue
 */
export function coprooverdueEmail(params: Record<string, string>) {
  const templates: Record<string, { subject: string; body: string }> = {
    "copro-fund-call": { subject: "Appel de fonds ${params.period} — ${params.amount}", body: "Lot ${params.lotNumber} — Tantiemes: ${params.tantiemes}. Montant: ${params.amount}. Echeance: ${params.dueDate}." },
    "copro-overdue": { subject: "Appel de fonds impaye — ${params.amount}", body: "Votre appel de fonds du ${params.dueDate} (montant: ${params.amount}) est en retard de ${params.daysLate} jours." },
    "copro-ag-convocation": { subject: "Convocation Assemblee Generale — ${params.agDate}", body: "Vous etes convoque a l'AG du ${params.agDate}. Ordre du jour et annexes joints." },
    "copro-exercise-closed": { subject: "Exercice ${params.year} cloture — Solde: ${params.balance}", body: "L'exercice ${params.year} a ete cloture. Charges: ${params.charges}. Provisions: ${params.provisions}. Solde: ${params.balance}." },
  };
  const t = templates["copro-overdue"] ?? { subject: "Notification Talok", body: "" };
  const subject = t.subject.replace(/\$\{params\.(\w+)\}/g, (_, k) => params[k] ?? "");
  const body = t.body.replace(/\$\{params\.(\w+)\}/g, (_, k) => params[k] ?? "");
  return {
    subject,
    html: `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#1B2A6B">${subject}</h2><p>Bonjour ${params.userName ?? ""},</p><p>${body}</p><a href="${params.appUrl ?? "https://app.talok.fr"}/owner/copro" style="display:inline-block;background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Voir ma situation</a><p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p></div>`,
  };
}

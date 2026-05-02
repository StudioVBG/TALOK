/**
 * Email template: regularization-due
 */
export function regularizationdueEmail(params: Record<string, string>) {
  const templates: Record<string, { subject: string; body: string }> = {
    "amortization-created": { subject: "Plan d'amortissement cree — ${params.propertyName} — ${params.annualAmount}/an", body: "Votre plan d'amortissement a ete cree avec succes." },
    "deficit-reported": { subject: "Deficit foncier ${params.year} — ${params.amount} reportable", body: "Un deficit foncier a ete detecte pour l'exercice ${params.year}." },
    "deficit-expiring": { subject: "Deficit ${params.year} expire bientot — ${params.amount} restant", body: "Votre deficit de ${params.year} expire dans ${params.monthsLeft} mois." },
    "regularization-due": { subject: "Regularisation charges ${params.year} — decompte syndic recu", body: "Un decompte syndic a ete analyse. Regularisez les charges." },
    "declaration-ready": { subject: "Votre declaration ${params.type} est prete", body: "Les donnees de votre declaration ${params.type} sont pretes." },
    "ec-annotation": { subject: "${params.cabinetName} a ajoute une remarque sur votre comptabilite", body: "${params.content}" },
    "exercise-closed": { subject: "Exercice ${params.year} cloture avec succes", body: "Revenus: ${params.revenue}, Charges: ${params.expenses}, Resultat: ${params.result}" },
  };
  const t = templates["regularization-due"] ?? { subject: "Notification Talok", body: "" };
  const subject = t.subject.replace(/\$\{params\.(\w+)\}/g, (_, k) => params[k] ?? "");
  const body = t.body.replace(/\$\{params\.(\w+)\}/g, (_, k) => params[k] ?? "");
  return {
    subject,
    html: `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#1B2A6B">${subject}</h2><p>Bonjour ${params.userName ?? ""},</p><p>${body}</p><a href="${params.appUrl ?? "https://talok.fr"}/owner/accounting" style="display:inline-block;background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Voir dans Talok</a><p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p></div>`,
  };
}

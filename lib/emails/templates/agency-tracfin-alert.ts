export function agencytracfinalertEmail(params: Record<string, string>) {
  const templates: Record<string, { subject: string; body: string }> = {
    "agency-daily-recap": { subject: "Recap loyers encaisses — ${params.date} — ${params.count} loyer(s)", body: "Total encaisse: ${params.total}." },
    "agency-reversal-late": { subject: "Reversement en retard — ${params.mandant} — ${params.amount}", body: "Le reversement pour ${params.mandant} est en retard de ${params.days} jours." },
    "agency-crg-available": { subject: "Compte Rendu de Gestion disponible — ${params.period}", body: "Votre CRG pour la periode ${params.period} est disponible." },
    "agency-tracfin-alert": { subject: "ALERTE TRACFIN — Mouvement > 10 000 EUR", body: "Un mouvement de ${params.amount} a ete detecte sur le compte mandant." },
    "agency-monthly-recap": { subject: "Recap mensuel agence — ${params.month}", body: "Loyers: ${params.loyers} | Honoraires: ${params.honoraires} | Reversements: ${params.reversements}" },
    "agency-carte-g-expiry": { subject: "Carte G expire dans ${params.days} jours", body: "Votre carte professionnelle G expire le ${params.expiryDate}. Pensez a la renouveler." },
  };
  const t = templates["agency-tracfin-alert"] ?? { subject: "Notification Talok", body: "" };
  const subject = t.subject.replace(/\$\{params\.(\w+)\}/g, (_, k) => params[k] ?? "");
  const body = t.body.replace(/\$\{params\.(\w+)\}/g, (_, k) => params[k] ?? "");
  return { subject, html: `<div style="font-family:'Manrope',sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#1B2A6B">${subject}</h2><p>Bonjour ${params.userName ?? ""},</p><p>${body}</p><a href="${params.appUrl ?? "https://app.talok.fr"}/agency/accounting" style="display:inline-block;background:#2563EB;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Voir dans Talok</a><p style="margin-top:24px;font-size:12px;color:#999">Talok — Gestion locative simplifiee</p></div>` };
}

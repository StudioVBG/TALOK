/**
 * Templates React Email pour les notifications agence
 */

import * as React from "react";
import { Section } from "@react-email/components";
import {
  TalokEmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailCard,
  EmailKeyValue,
} from "./base-layout";

// =============================================================================
// Agency Daily Recap
// =============================================================================

export interface AgencyDailyRecapProps {
  userName: string;
  date: string;
  count: string;
  total: string;
  appUrl?: string;
}

export function AgencyDailyRecapEmail({
  userName = "Gestionnaire",
  date = "08/04/2026",
  count = "3",
  total = "2 550,00 EUR",
  appUrl = "https://talok.fr/agency/accounting",
}: AgencyDailyRecapProps) {
  return (
    <TalokEmailLayout preheader={`Recap loyers encaisses — ${date} — ${count} loyer(s)`}>
      <EmailHeading>Recap loyers encaisses</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailCard>
        <EmailKeyValue label="Date" value={date} />
        <EmailKeyValue label="Loyers encaisses" value={`${count} loyer(s)`} />
        <EmailKeyValue label="Total encaisse" value={total} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Agency Reversal Late
// =============================================================================

export interface AgencyReversalLateProps {
  userName: string;
  mandant: string;
  amount: string;
  days: string;
  appUrl?: string;
}

export function AgencyReversalLateEmail({
  userName = "Gestionnaire",
  mandant = "M. Dupont",
  amount = "850,00 EUR",
  days = "5",
  appUrl = "https://talok.fr/agency/accounting",
}: AgencyReversalLateProps) {
  return (
    <TalokEmailLayout preheader={`Reversement en retard — ${mandant} — ${amount}`}>
      <EmailHeading>Reversement en retard</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Le reversement pour <strong>{mandant}</strong> est en retard de{" "}
        <strong>{days} jours</strong>.
      </EmailText>
      <EmailCard>
        <EmailKeyValue label="Mandant" value={mandant} />
        <EmailKeyValue label="Montant" value={amount} />
        <EmailKeyValue label="Retard" value={`${days} jours`} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Agency CRG Available
// =============================================================================

export interface AgencyCrgAvailableProps {
  userName: string;
  period: string;
  appUrl?: string;
}

export function AgencyCrgAvailableEmail({
  userName = "Gestionnaire",
  period = "Q1 2026",
  appUrl = "https://talok.fr/agency/accounting/crg",
}: AgencyCrgAvailableProps) {
  return (
    <TalokEmailLayout preheader={`Compte Rendu de Gestion disponible — ${period}`}>
      <EmailHeading>CRG disponible</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Votre Compte Rendu de Gestion pour la periode <strong>{period}</strong>{" "}
        est disponible.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Consulter le CRG</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Agency Tracfin Alert
// =============================================================================

export interface AgencyTracfinAlertProps {
  userName: string;
  amount: string;
  appUrl?: string;
}

export function AgencyTracfinAlertEmail({
  userName = "Gestionnaire",
  amount = "15 000,00 EUR",
  appUrl = "https://talok.fr/agency/accounting",
}: AgencyTracfinAlertProps) {
  return (
    <TalokEmailLayout preheader={`ALERTE TRACFIN — Mouvement > 10 000 EUR`}>
      <EmailHeading>ALERTE TRACFIN</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Un mouvement de <strong>{amount}</strong> a ete detecte sur le compte
        mandant. Ce mouvement depasse le seuil de declaration TRACFIN.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir le mouvement</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Agency Monthly Recap
// =============================================================================

export interface AgencyMonthlyRecapProps {
  userName: string;
  month: string;
  loyers: string;
  honoraires: string;
  reversements: string;
  appUrl?: string;
}

export function AgencyMonthlyRecapEmail({
  userName = "Gestionnaire",
  month = "Mars 2026",
  loyers = "25 400,00 EUR",
  honoraires = "1 778,00 EUR",
  reversements = "23 622,00 EUR",
  appUrl = "https://talok.fr/agency/accounting",
}: AgencyMonthlyRecapProps) {
  return (
    <TalokEmailLayout preheader={`Recap mensuel agence — ${month}`}>
      <EmailHeading>Recap mensuel — {month}</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailCard>
        <EmailKeyValue label="Loyers encaisses" value={loyers} />
        <EmailKeyValue label="Honoraires" value={honoraires} />
        <EmailKeyValue label="Reversements" value={reversements} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir le detail</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Agency Carte G Expiry
// =============================================================================

export interface AgencyCarteGExpiryProps {
  userName: string;
  days: string;
  expiryDate: string;
  appUrl?: string;
}

export function AgencyCarteGExpiryEmail({
  userName = "Gestionnaire",
  days = "30",
  expiryDate = "08/05/2026",
  appUrl = "https://talok.fr/agency/settings",
}: AgencyCarteGExpiryProps) {
  return (
    <TalokEmailLayout preheader={`Carte G expire dans ${days} jours`}>
      <EmailHeading>Carte G bientot expiree</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Votre carte professionnelle G expire le <strong>{expiryDate}</strong>{" "}
        (dans {days} jours). Pensez a la renouveler pour continuer votre
        activite de gestion.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl} variant="warning">Gerer ma carte G</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

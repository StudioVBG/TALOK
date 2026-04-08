/**
 * Templates React Email pour les notifications copropriete
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
// Copro Fund Call
// =============================================================================

export interface CoproFundCallProps {
  userName: string;
  period: string;
  amount: string;
  lotNumber: string;
  tantiemes: string;
  dueDate: string;
  appUrl?: string;
}

export function CoproFundCallEmail({
  userName = "Coproprietaire",
  period = "T2 2026",
  amount = "1 250,00 EUR",
  lotNumber = "12",
  tantiemes = "85/1000",
  dueDate = "01/07/2026",
  appUrl = "https://talok.fr/copro/charges",
}: CoproFundCallProps) {
  return (
    <TalokEmailLayout preheader={`Appel de fonds ${period} — ${amount}`}>
      <EmailHeading>Appel de fonds {period}</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailCard>
        <EmailKeyValue label="Lot" value={lotNumber} />
        <EmailKeyValue label="Tantiemes" value={tantiemes} />
        <EmailKeyValue label="Montant" value={amount} />
        <EmailKeyValue label="Echeance" value={dueDate} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir mes charges</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Copro Overdue
// =============================================================================

export interface CoproOverdueProps {
  userName: string;
  amount: string;
  dueDate: string;
  daysLate: string;
  appUrl?: string;
}

export function CoproOverdueEmail({
  userName = "Coproprietaire",
  amount = "1 250,00 EUR",
  dueDate = "01/04/2026",
  daysLate = "8",
  appUrl = "https://talok.fr/copro/charges",
}: CoproOverdueProps) {
  return (
    <TalokEmailLayout preheader={`Appel de fonds impaye — ${amount}`}>
      <EmailHeading>Appel de fonds impaye</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Votre appel de fonds du <strong>{dueDate}</strong> (montant :{" "}
        <strong>{amount}</strong>) est en retard de <strong>{daysLate} jours</strong>.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl} variant="warning">Regulariser</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Copro AG Convocation
// =============================================================================

export interface CoproAgConvocationProps {
  userName: string;
  agDate: string;
  appUrl?: string;
}

export function CoproAgConvocationEmail({
  userName = "Coproprietaire",
  agDate = "15/05/2026",
  appUrl = "https://talok.fr/copro/assemblies",
}: CoproAgConvocationProps) {
  return (
    <TalokEmailLayout preheader={`Convocation Assemblee Generale — ${agDate}`}>
      <EmailHeading>Convocation AG</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Vous etes convoque a l'Assemblee Generale du <strong>{agDate}</strong>.
        L'ordre du jour et les annexes sont joints a cet email.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir les details</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Copro Exercise Closed
// =============================================================================

export interface CoproExerciseClosedProps {
  userName: string;
  year: string;
  charges: string;
  provisions: string;
  balance: string;
  appUrl?: string;
}

export function CoproExerciseClosedEmail({
  userName = "Coproprietaire",
  year = "2025",
  charges = "3 200,00 EUR",
  provisions = "3 000,00 EUR",
  balance = "-200,00 EUR",
  appUrl = "https://talok.fr/copro/charges",
}: CoproExerciseClosedProps) {
  return (
    <TalokEmailLayout preheader={`Exercice ${year} cloture — Solde: ${balance}`}>
      <EmailHeading>Exercice {year} cloture</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailCard>
        <EmailKeyValue label="Charges reelles" value={charges} />
        <EmailKeyValue label="Provisions versees" value={provisions} />
        <EmailKeyValue label="Solde" value={balance} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir le detail</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

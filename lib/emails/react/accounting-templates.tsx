/**
 * Templates React Email pour les notifications comptabilite
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
// Amortization Created
// =============================================================================

export interface AmortizationCreatedProps {
  userName: string;
  propertyName: string;
  annualAmount: string;
  appUrl?: string;
}

export function AmortizationCreatedEmail({
  userName = "Proprietaire",
  propertyName = "Appartement Fort-de-France",
  annualAmount = "3 500,00 EUR",
  appUrl = "https://talok.fr/owner/accounting",
}: AmortizationCreatedProps) {
  return (
    <TalokEmailLayout preheader={`Plan d'amortissement cree — ${propertyName}`}>
      <EmailHeading>Plan d'amortissement cree</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Votre plan d'amortissement a ete cree avec succes pour le bien{" "}
        <strong>{propertyName}</strong>.
      </EmailText>
      <EmailCard>
        <EmailKeyValue label="Bien" value={propertyName} />
        <EmailKeyValue label="Amortissement annuel" value={`${annualAmount}/an`} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Deficit Reported
// =============================================================================

export interface DeficitReportedProps {
  userName: string;
  year: string;
  amount: string;
  appUrl?: string;
}

export function DeficitReportedEmail({
  userName = "Proprietaire",
  year = "2025",
  amount = "4 200,00 EUR",
  appUrl = "https://talok.fr/owner/accounting",
}: DeficitReportedProps) {
  return (
    <TalokEmailLayout preheader={`Deficit foncier ${year} — ${amount} reportable`}>
      <EmailHeading>Deficit foncier detecte</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Un deficit foncier de <strong>{amount}</strong> a ete detecte pour
        l'exercice <strong>{year}</strong>. Ce montant est reportable sur les
        annees suivantes.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Deficit Expiring
// =============================================================================

export interface DeficitExpiringProps {
  userName: string;
  year: string;
  amount: string;
  monthsLeft: string;
  appUrl?: string;
}

export function DeficitExpiringEmail({
  userName = "Proprietaire",
  year = "2016",
  amount = "2 100,00 EUR",
  monthsLeft = "3",
  appUrl = "https://talok.fr/owner/accounting",
}: DeficitExpiringProps) {
  return (
    <TalokEmailLayout preheader={`Deficit ${year} expire bientot — ${amount} restant`}>
      <EmailHeading>Deficit foncier bientot expire</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Votre deficit foncier de <strong>{year}</strong> ({amount} restant)
        expire dans <strong>{monthsLeft} mois</strong>. Pensez a l'imputer
        avant la date limite.
      </EmailText>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl} variant="warning">Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// Exercise Closed
// =============================================================================

export interface ExerciseClosedProps {
  userName: string;
  year: string;
  revenue: string;
  expenses: string;
  result: string;
  appUrl?: string;
}

export function ExerciseClosedEmail({
  userName = "Proprietaire",
  year = "2025",
  revenue = "12 000,00 EUR",
  expenses = "4 500,00 EUR",
  result = "7 500,00 EUR",
  appUrl = "https://talok.fr/owner/accounting",
}: ExerciseClosedProps) {
  return (
    <TalokEmailLayout preheader={`Exercice ${year} cloture avec succes`}>
      <EmailHeading>Exercice {year} cloture</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailCard>
        <EmailKeyValue label="Revenus" value={revenue} />
        <EmailKeyValue label="Charges" value={expenses} />
        <EmailKeyValue label="Resultat" value={result} />
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl} variant="success">Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// =============================================================================
// EC Annotation
// =============================================================================

export interface EcAnnotationProps {
  userName: string;
  cabinetName: string;
  content: string;
  appUrl?: string;
}

export function EcAnnotationEmail({
  userName = "Proprietaire",
  cabinetName = "Cabinet Dupont",
  content = "Merci de verifier l'ecriture du 15/03.",
  appUrl = "https://talok.fr/owner/accounting",
}: EcAnnotationProps) {
  return (
    <TalokEmailLayout preheader={`${cabinetName} a ajoute une remarque`}>
      <EmailHeading>Remarque de votre expert-comptable</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        <strong>{cabinetName}</strong> a ajoute une remarque sur votre
        comptabilite :
      </EmailText>
      <EmailCard>
        <EmailText>{content}</EmailText>
      </EmailCard>
      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

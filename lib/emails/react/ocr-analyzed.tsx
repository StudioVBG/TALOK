/**
 * Template React Email : Justificatif analyse par OCR
 *
 * Equivalent React Email de lib/emails/templates/ocr-analyzed.ts
 * Envoye au proprietaire apres analyse reussie d'un document comptable.
 */

import * as React from "react";
import { Section, Text, Row, Column } from "@react-email/components";
import {
  TalokEmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
  EmailCard,
} from "./base-layout";

export interface OcrAnalyzedEmailProps {
  ownerName: string;
  documentType: string;
  montantTtcCents: number;
  supplierName: string;
  suggestedCategory: string;
  confidence: number;
  verifyUrl: string;
}

function formatMontant(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function OcrAnalyzedEmail({
  ownerName = "Proprietaire",
  documentType = "Facture",
  montantTtcCents = 15000,
  supplierName = "Fournisseur",
  suggestedCategory = "Non categorise",
  confidence = 0.85,
  verifyUrl = "https://talok.fr/owner/accounting",
}: OcrAnalyzedEmailProps) {
  const montant = formatMontant(montantTtcCents);
  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor = confidencePercent >= 80 ? "#10b981" : "#f59e0b";

  return (
    <TalokEmailLayout
      preheader={`Justificatif analyse - ${montant} EUR - ${suggestedCategory}`}
    >
      <EmailHeading>Justificatif analyse</EmailHeading>
      <EmailText>Bonjour {ownerName},</EmailText>
      <EmailText>
        Nous avons analyse votre document et voici ce que nous avons detecte :
      </EmailText>

      <EmailCard>
        <DetailRow label="Type de document" value={documentType} />
        <DetailRow label="Fournisseur" value={supplierName} />
        <DetailRow
          label="Montant TTC"
          value={`${montant} EUR`}
          valueStyle={{ color: "#2563eb", fontSize: "18px", fontWeight: "700" }}
        />
        <DetailRow label="Categorie suggeree" value={suggestedCategory} />
        <DetailRow
          label="Confiance"
          value={`${confidencePercent}%`}
          valueStyle={{ color: confidenceColor, fontWeight: "600" }}
          isLast
        />
      </EmailCard>

      <EmailText>
        Verifiez les informations et validez l'ecriture comptable :
      </EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={verifyUrl}>Verifier et valider</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

// Composant interne pour les lignes de detail
function DetailRow({
  label,
  value,
  valueStyle,
  isLast,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
  isLast?: boolean;
}) {
  return (
    <Row
      style={{
        borderBottom: isLast ? "none" : "1px solid #e5e7eb",
        padding: "12px 0",
      }}
    >
      <Column style={{ color: "#6b7280", fontSize: "14px" }}>{label}</Column>
      <Column
        style={{
          textAlign: "right",
          fontWeight: "500",
          color: "#111827",
          fontSize: "14px",
          ...valueStyle,
        }}
      >
        {value}
      </Column>
    </Row>
  );
}

// Export par defaut pour le preview React Email
export default OcrAnalyzedEmail;

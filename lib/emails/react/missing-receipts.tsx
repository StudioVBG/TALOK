/**
 * Template React Email : Justificatifs manquants (hebdomadaire)
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

export interface MissingReceiptEntry {
  label: string;
  date: string;
  montantTtcCents: number;
}

export interface MissingReceiptsEmailProps {
  ownerName: string;
  entries: MissingReceiptEntry[];
  entriesUrl: string;
}

function formatMontant(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MissingReceiptsEmail({
  ownerName = "Proprietaire",
  entries = [],
  entriesUrl = "https://talok.fr/owner/accounting",
}: MissingReceiptsEmailProps) {
  const count = entries.length;
  const displayed = entries.slice(0, 10);
  const remaining = count > 10 ? count - 10 : 0;

  return (
    <TalokEmailLayout
      preheader={`${count} charge${count > 1 ? "s" : ""} sans justificatif`}
    >
      <EmailHeading>
        {count} charge{count > 1 ? "s" : ""} sans justificatif
      </EmailHeading>
      <EmailText>Bonjour {ownerName},</EmailText>
      <EmailText>
        Les ecritures suivantes n'ont toujours pas de justificatif rattache
        depuis plus de 7 jours :
      </EmailText>

      <EmailCard>
        {/* Header */}
        <Row style={{ borderBottom: "2px solid #e5e7eb", backgroundColor: "#f9fafb" }}>
          <Column style={headerStyle}>Libelle</Column>
          <Column style={headerStyle}>Date</Column>
          <Column style={{ ...headerStyle, textAlign: "right" }}>Montant</Column>
        </Row>

        {/* Rows */}
        {displayed.map((entry, i) => (
          <Row key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
            <Column style={cellStyle}>{entry.label}</Column>
            <Column style={{ ...cellStyle, color: "#6b7280" }}>{entry.date}</Column>
            <Column style={{ ...cellStyle, textAlign: "right", fontWeight: 500 }}>
              {formatMontant(entry.montantTtcCents)} EUR
            </Column>
          </Row>
        ))}

        {remaining > 0 && (
          <Text style={{ color: "#6b7280", fontSize: "13px", textAlign: "center", marginTop: "8px" }}>
            ... et {remaining} autre(s) ecriture(s)
          </Text>
        )}
      </EmailCard>

      <EmailText>
        Pensez a joindre vos justificatifs pour une comptabilite complete et
        conforme.
      </EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={entriesUrl}>Voir les ecritures</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

const headerStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  color: "#6b7280",
  fontSize: "13px",
  fontWeight: 500,
};

const cellStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "#111827",
  fontSize: "14px",
};

export default MissingReceiptsEmail;

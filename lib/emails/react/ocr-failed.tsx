/**
 * Template React Email : Document illisible (OCR echoue)
 */

import * as React from "react";
import { Section, Text } from "@react-email/components";
import {
  TalokEmailLayout,
  EmailHeading,
  EmailText,
  EmailButton,
} from "./base-layout";

export interface OcrFailedEmailProps {
  ownerName: string;
  fileName?: string;
  uploadUrl: string;
}

export function OcrFailedEmail({
  ownerName = "Proprietaire",
  fileName,
  uploadUrl = "https://talok.fr/owner/accounting",
}: OcrFailedEmailProps) {
  return (
    <TalokEmailLayout preheader="Document illisible - saisie manuelle necessaire">
      <EmailHeading>Document illisible</EmailHeading>
      <EmailText>Bonjour {ownerName},</EmailText>
      <EmailText>
        Nous n'avons pas pu lire automatiquement votre document. Cela peut
        arriver lorsque le fichier est de mauvaise qualite, protege ou dans un
        format non supporte.
      </EmailText>

      {fileName && (
        <EmailText muted>
          Fichier concerne : <strong>{fileName}</strong>
        </EmailText>
      )}

      <Section
        style={{
          backgroundColor: "#fef3c7",
          borderLeft: "4px solid #f59e0b",
          padding: "20px 24px",
          margin: "24px 0",
          borderRadius: "0 8px 8px 0",
        }}
      >
        <Text style={{ margin: 0, color: "#92400e", fontWeight: 500 }}>
          Veuillez saisir les informations manuellement pour completer votre
          comptabilite.
        </Text>
      </Section>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={uploadUrl} variant="warning">
          Saisir manuellement
        </EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

export default OcrFailedEmail;

/**
 * Template React Email : Declaration fiscale prete
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

export interface DeclarationReadyEmailProps {
  userName: string;
  declarationType: string;
  year?: string;
  appUrl?: string;
}

export function DeclarationReadyEmail({
  userName = "Proprietaire",
  declarationType = "2044",
  year = "2025",
  appUrl = "https://talok.fr/owner/accounting",
}: DeclarationReadyEmailProps) {
  return (
    <TalokEmailLayout
      preheader={`Votre declaration ${declarationType} est prete`}
    >
      <EmailHeading>
        Votre declaration {declarationType} est prete
      </EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Les donnees de votre declaration {declarationType} pour l'annee {year}{" "}
        sont pretes. Vous pouvez les consulter et les telecharger dans votre
        espace comptabilite.
      </EmailText>

      <EmailCard>
        <EmailKeyValue label="Type de declaration" value={declarationType} />
        <EmailKeyValue label="Annee fiscale" value={year} />
      </EmailCard>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Voir dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

export default DeclarationReadyEmail;

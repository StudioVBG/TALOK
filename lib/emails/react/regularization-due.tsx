/**
 * Template React Email : Regularisation charges due
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

export interface RegularizationDueEmailProps {
  userName: string;
  year: string;
  propertyAddress?: string;
  appUrl?: string;
}

export function RegularizationDueEmail({
  userName = "Proprietaire",
  year = "2025",
  propertyAddress,
  appUrl = "https://talok.fr/owner/accounting",
}: RegularizationDueEmailProps) {
  return (
    <TalokEmailLayout
      preheader={`Regularisation charges ${year} — decompte syndic recu`}
    >
      <EmailHeading>Regularisation charges {year}</EmailHeading>
      <EmailText>Bonjour {userName},</EmailText>
      <EmailText>
        Un decompte syndic a ete analyse pour l'exercice {year}. Vous pouvez
        maintenant regulariser les charges de vos locataires.
      </EmailText>

      <EmailCard>
        <EmailKeyValue label="Exercice" value={year} />
        {propertyAddress && (
          <EmailKeyValue label="Bien concerne" value={propertyAddress} />
        )}
      </EmailCard>

      <EmailText>
        La regularisation permet de calculer la difference entre les provisions
        versees par vos locataires et les charges reelles. Pensez a la
        realiser dans les meilleurs delais.
      </EmailText>

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <EmailButton href={appUrl}>Regulariser dans Talok</EmailButton>
      </Section>
    </TalokEmailLayout>
  );
}

export default RegularizationDueEmail;

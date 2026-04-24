import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { FeatureStubPage } from "@/components/marketing/FeatureStubPage";

export const metadata: Metadata = {
  title: "Documents & coffre-fort locatif | Talok",
  description:
    "Centralisez tous vos documents locatifs dans un coffre-fort sécurisé. Quittances, baux, diagnostics, CNI, attestations — tout au même endroit.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://talok.fr/fonctionnalites/documents" },
};

export default function DocumentsPage() {
  return (
    <FeatureStubPage
      icon={FolderOpen}
      badgeLabel="Documents"
      title="Votre coffre-fort locatif"
      highlight="chiffré et organisé"
      subtitle="Tous vos documents locatifs au même endroit : baux, quittances, diagnostics, CNI, attestations. Partage sécurisé en un clic."
      bullets={[
        "Stockage sécurisé et chiffré, hébergé en France",
        "Classement automatique par bien et par locataire",
        "Partage sécurisé avec lien temporaire (garant, banque, notaire)",
        "Relecture OCR automatique des pièces justificatives",
        "Archivage conforme (10 ans) et export groupé",
      ]}
    />
  );
}

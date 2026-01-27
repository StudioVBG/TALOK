import type { Metadata } from "next";
import { NewPropertyClient } from "./NewPropertyClient";

// SEO Metadata - SOTA 2026
export const metadata: Metadata = {
  title: "Ajouter un bien | Talok",
  description: "Créez un nouveau bien immobilier dans votre portefeuille locatif. Appartement, maison, parking, local commercial ou immeuble entier.",
  robots: {
    index: false, // Page privée, ne pas indexer
    follow: false,
  },
  openGraph: {
    title: "Ajouter un bien | Talok",
    description: "Créez un nouveau bien immobilier dans votre portefeuille locatif.",
    type: "website",
  },
};

export default function OwnerNewPropertyPage() {
  return <NewPropertyClient />;
}

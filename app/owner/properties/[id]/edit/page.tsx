import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Redirection serveur 307 vers la fiche du bien (l'édition se fait inline via
 * le bouton "Modifier le bien"). Pas de page d'édition séparée.
 */
export default async function EditPropertyPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/owner/properties/${id}`);
}

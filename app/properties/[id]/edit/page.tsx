import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Route legacy /properties/[id]/edit → 307 vers /owner/properties/[id].
 * L'édition se fait inline sur la fiche du bien.
 */
export default async function LegacyEditPropertyPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/owner/properties/${id}`);
}

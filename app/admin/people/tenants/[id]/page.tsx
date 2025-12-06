/**
 * Redirection vers /admin/tenants/[id]
 * Cette page existe pour résoudre l'incohérence de routing
 * Le lien dans PeopleClient pointe vers /admin/people/tenants/[id]
 * mais la page réelle est /admin/tenants/[id]
 */
import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPeopleTenantRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/admin/tenants/${id}`);
}

export const metadata = {
  title: "Redirection...",
};


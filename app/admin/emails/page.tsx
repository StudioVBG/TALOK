export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export const metadata = {
  title: "Templates d'Emails | Administration",
  description: "Visualiser et gérer tous les templates d'emails envoyés par Talok",
};

/**
 * Consolidated: /admin/emails now redirects to /admin/email-templates
 * to avoid having two separate pages for the same email template data.
 * The email-templates page provides the full editor + viewer experience.
 */
export default async function AdminEmailsPage() {
  redirect("/admin/email-templates");
}

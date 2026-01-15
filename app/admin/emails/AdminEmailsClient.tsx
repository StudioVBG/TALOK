"use client";

import { EmailTemplatesViewer } from "@/components/emails/email-templates-viewer";
import { EMAIL_TEMPLATES_DATA } from "@/lib/emails/templates-data";

export function AdminEmailsClient() {
  return (
    <div className="p-6 h-[calc(100vh-80px)]">
      <EmailTemplatesViewer
        templates={EMAIL_TEMPLATES_DATA}
        title="Templates d'Emails - Administration"
        showFilters={true}
        className="h-full"
      />
    </div>
  );
}

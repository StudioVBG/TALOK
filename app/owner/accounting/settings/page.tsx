import { Suspense } from "react";
import SettingsPageClient from "./SettingsPageClient";

export const metadata = { title: "Paramètres comptables | Talok" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageClient />
    </Suspense>
  );
}

function SettingsPageSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-64" />
      <div className="h-48 bg-muted rounded-xl" />
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}

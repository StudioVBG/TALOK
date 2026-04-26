import { Suspense } from "react";
import EntryDetailClient from "./EntryDetailClient";

export const metadata = { title: "Détail écriture | Talok" };

interface EntryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EntryDetailPage({ params }: EntryDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<EntryDetailSkeleton />}>
      <EntryDetailClient entryId={id} />
    </Suspense>
  );
}

function EntryDetailSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-6 bg-muted rounded w-48" />
      <div className="h-32 bg-muted rounded-xl" />
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}

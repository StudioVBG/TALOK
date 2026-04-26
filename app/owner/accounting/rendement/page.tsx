import { Suspense } from "react";
import RendementPageClient from "./RendementPageClient";

export const metadata = { title: "Rendement par bien | Talok" };

export default function RendementPage() {
  return (
    <Suspense fallback={<RendementSkeleton />}>
      <RendementPageClient />
    </Suspense>
  );
}

function RendementSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}

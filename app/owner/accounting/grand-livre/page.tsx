import { Suspense } from "react";
import GrandLivrePageClient from "./GrandLivrePageClient";

export const metadata = { title: "Grand livre | Talok" };

export default function GrandLivrePage() {
  return (
    <Suspense fallback={<GrandLivreSkeleton />}>
      <GrandLivrePageClient />
    </Suspense>
  );
}

function GrandLivreSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}

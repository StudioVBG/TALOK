import { Suspense } from "react";
import CoproOwnerClient from "./CoproOwnerClient";

export const metadata = { title: "Ma copropriete | Talok" };

export default function CoproOwnerPage() {
  return (
    <Suspense fallback={<CoproOwnerSkeleton />}>
      <CoproOwnerClient />
    </Suspense>
  );
}

function CoproOwnerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-44 bg-muted rounded-xl" />
        <div className="h-44 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
      <div className="h-32 bg-muted rounded-xl" />
      <div className="h-40 bg-muted rounded-xl" />
    </div>
  );
}

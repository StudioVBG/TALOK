import { Suspense } from "react";
import FondsTravauxClient from "./FondsTravauxClient";

export const metadata = { title: "Fonds de travaux | Talok Syndic" };

export default function FondsTravauxPage() {
  return (
    <Suspense fallback={<FondsTravauxSkeleton />}>
      <FondsTravauxClient />
    </Suspense>
  );
}

function FondsTravauxSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-72 bg-muted rounded-xl" />
    </div>
  );
}

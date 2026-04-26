import { Suspense } from "react";
import TvaPageClient from "./TvaPageClient";

export const metadata = { title: "Déclaration TVA | Talok" };

export default function TvaPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <TvaPageClient />
    </Suspense>
  );
}

function Skeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded w-56" />
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}

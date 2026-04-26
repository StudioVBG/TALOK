import { Suspense } from "react";
import PropertyAcquisitionsPageClient from "./PropertyAcquisitionsPageClient";

export const metadata = { title: "Acquisitions immobilières | Talok" };

export default function PropertyAcquisitionsPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <PropertyAcquisitionsPageClient />
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

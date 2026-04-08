import { Suspense } from "react";
import CoproCloseClient from "./CoproCloseClient";

export const metadata = { title: "Cloture exercice | Talok" };

export default function CoproClosePage() {
  return (
    <Suspense fallback={<CloseSkeleton />}>
      <CoproCloseClient />
    </Suspense>
  );
}

function CloseSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-48" />
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-10 bg-muted rounded-full" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-xl" />
    </div>
  );
}

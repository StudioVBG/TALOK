import { Suspense } from "react";
import ConnectBankClient from "./ConnectBankClient";

export const metadata = { title: "Connecter un compte bancaire | Talok" };

export default function ConnectBankPage() {
  return (
    <Suspense fallback={<ConnectBankSkeleton />}>
      <ConnectBankClient />
    </Suspense>
  );
}

function ConnectBankSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-lg" />
      <div className="h-2 w-full bg-muted rounded-full" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}

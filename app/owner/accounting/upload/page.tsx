import { Suspense } from "react";
import UploadFlowClient from "./UploadFlowClient";

export const metadata = { title: "Scanner un justificatif | Talok" };

export default function UploadPage() {
  return (
    <Suspense fallback={<UploadSkeleton />}>
      <UploadFlowClient />
    </Suspense>
  );
}

function UploadSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-64" />
      <div className="h-2 bg-muted rounded-full" />
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}

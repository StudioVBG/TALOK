import { Suspense } from "react";
import ECManageClient from "./ECManageClient";
export const metadata = { title: "Expert-comptable | Talok" };
export default function ECPage() {
  return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-64 bg-muted rounded-xl" /></div>}><ECManageClient /></Suspense>);
}

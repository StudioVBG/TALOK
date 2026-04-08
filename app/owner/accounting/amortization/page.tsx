import { Suspense } from "react";
import AmortizationClient from "./AmortizationClient";
export const metadata = { title: "Amortissements | Talok" };
export default function AmortizationPage() {
  return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-64 bg-muted rounded-xl" /></div>}><AmortizationClient /></Suspense>);
}

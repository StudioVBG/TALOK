import { Suspense } from "react";
import ECDashboardClient from "./ECDashboardClient";
export const metadata = { title: "Portail Expert-Comptable | Talok" };
export default function ECDashboardPage() {
  return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-64 bg-muted rounded-xl" /></div>}><ECDashboardClient /></Suspense>);
}

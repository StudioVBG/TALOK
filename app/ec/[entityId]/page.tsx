import { Suspense } from "react";
import ECClientView from "./ECClientView";
export const metadata = { title: "Client | Portail EC | Talok" };
export default function ECClientPage() {
  return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-96 bg-muted rounded-xl" /></div>}><ECClientView /></Suspense>);
}

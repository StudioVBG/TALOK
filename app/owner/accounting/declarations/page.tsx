import { Suspense } from "react";
import DeclarationsClient from "./DeclarationsClient";
export const metadata = { title: "Declarations fiscales | Talok" };
export default function DeclarationsPage() {
  return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-96 bg-muted rounded-xl" /></div>}><DeclarationsClient /></Suspense>);
}

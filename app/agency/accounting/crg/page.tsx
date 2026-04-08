import { Suspense } from "react";
import CRGClient from "./CRGClient";
export const metadata = { title: "Comptes Rendus de Gestion | Talok" };
export default function CRGPage() { return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-64 bg-muted rounded-xl" /></div>}><CRGClient /></Suspense>); }

import { Suspense } from "react";
import HoguetClient from "./HoguetClient";
export const metadata = { title: "Conformite Hoguet | Talok" };
export default function HoguetPage() { return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-64 bg-muted rounded-xl" /></div>}><HoguetClient /></Suspense>); }

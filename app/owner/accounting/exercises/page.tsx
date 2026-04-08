import { Suspense } from "react";
import ExercisesClient from "./ExercisesClient";
export const metadata = { title: "Exercices comptables | Talok" };
export default function ExercisesPage() {
  return (<Suspense fallback={<div className="p-6 animate-pulse"><div className="h-8 bg-muted rounded w-48 mb-6" /><div className="h-64 bg-muted rounded-xl" /></div>}><ExercisesClient /></Suspense>);
}

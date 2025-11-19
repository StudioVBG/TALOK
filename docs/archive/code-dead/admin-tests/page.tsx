/**
 * Admin Process & QA Page
 * 
 * Permet de tester régulièrement les processus critiques de l'application
 * pour s'assurer qu'ils fonctionnent correctement après refacto.
 */

"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { ProcessTestsContent } from "@/features/admin/components/process-tests-content";

export default function ProcessTestsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <ProcessTestsContent />
    </ProtectedRoute>
  );
}


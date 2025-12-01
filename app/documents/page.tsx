"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { DocumentsList } from "@/features/documents/components/documents-list";

export default function DocumentsPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mes documents</h1>
          <p className="text-muted-foreground">Gérez vos documents</p>
        </div>

        <DocumentsList />
      </div>
    </ProtectedRoute>
  );
}


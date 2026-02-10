"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  FolderOpen,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

interface DocumentItem {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
  title?: string;
  name?: string;
}

interface LeaseDocumentsTabProps {
  leaseId: string;
  propertyId: string;
  documents: DocumentItem[];
  dpeStatus: { status: string; data?: any } | null;
}

const DOC_LABELS: Record<string, string> = {
  diagnostic_performance: "DPE (Énergie)",
  diagnostic_amiante: "Diagnostic Amiante",
  attestation_assurance: "Attestation Assurance",
  EDL_entree: "État des Lieux d'entrée",
  annexe_pinel: "Annexe Loi Pinel",
  etat_travaux: "État des travaux",
  autre: "Document annexe",
};

function getDocLabel(doc: DocumentItem): string {
  if (doc.title) return doc.title;
  return DOC_LABELS[doc.type] || doc.name || doc.type;
}

export function LeaseDocumentsTab({ leaseId, propertyId, documents, dpeStatus }: LeaseDocumentsTabProps) {
  // Filtrer et dé-dupliquer les annexes contractuelles
  const annexTypes = ["diagnostic_performance", "diagnostic_amiante", "attestation_assurance", "EDL_entree", "annexe_pinel", "etat_travaux", "autre"];

  const leaseAnnexes = Object.values(
    documents
      .filter((doc) => annexTypes.includes(doc.type))
      .reduce((acc: Record<string, DocumentItem>, doc) => {
        if (!acc[doc.type] || new Date(doc.created_at) > new Date(acc[doc.type].created_at)) {
          acc[doc.type] = doc;
        }
        return acc;
      }, {})
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 py-4"
    >
      {/* Alerte DPE si manquant */}
      {dpeStatus?.status !== "VALID" && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                DPE {dpeStatus?.status === "EXPIRED" ? "Expiré" : "Manquant"}
              </p>
              <p className="text-xs text-amber-700">Obligatoire pour le bail (loi Climat 2021)</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-100" asChild>
            <Link href={`/owner/properties/${propertyId}/diagnostics`}>
              <ShieldAlert className="h-4 w-4 mr-2" />
              Régulariser
            </Link>
          </Button>
        </div>
      )}

      {/* Liste des documents */}
      {leaseAnnexes.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {leaseAnnexes.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate pr-4">
                    {getDocLabel(doc)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ajouté le {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                <a href={`/api/documents/view?path=${encodeURIComponent(doc.storage_path)}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Voir
                </a>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-sm text-slate-400">Aucune annexe contractuelle jointe</p>
        </div>
      )}

      {/* Compteur total + bouton gérer */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {documents.length} document{documents.length > 1 ? "s" : ""} au total ({leaseAnnexes.length} annexe{leaseAnnexes.length > 1 ? "s" : ""})
        </p>
        <Button variant="outline" size="sm" className="border-dashed" asChild>
          <Link href={`/owner/documents?lease_id=${leaseId}`}>
            <FolderOpen className="h-3.5 w-3.5 mr-2" />
            Gérer tous les documents
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

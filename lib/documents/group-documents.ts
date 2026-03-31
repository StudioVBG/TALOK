/**
 * Groupement des documents CNI recto/verso
 *
 * Règle : deux documents `cni_recto` + `cni_verso` appartenant au même
 * tenant (même tenant_id, ou à défaut même lease_id) sont fusionnés en
 * un seul `GroupedDocument` affiché comme une carte unique.
 * Tous les autres documents sont retournés tels quels.
 */

import type { Document } from "@/lib/types";

export interface GroupedDocument {
  /** Identifiant du groupe (= id du recto) */
  id: string;
  /** Discriminant permettant de distinguer du type `Document` */
  group_type: "cni";
  recto: Document;
  verso: Document | null;
  tenant_id: string | null;
  lease_id: string | null;
  created_at: string;
}

export type DisplayDocument = Document | GroupedDocument;

/**
 * Regroupe les CNI recto+verso dans une liste de documents.
 *
 * @param docs - Liste brute de documents (peut contenir des types quelconques)
 * @returns Liste où les paires cni_recto/cni_verso sont remplacées par un GroupedDocument
 */
export function groupDocuments(docs: Document[]): DisplayDocument[] {
  const rectos: Document[] = [];
  const versos: Document[] = [];
  const others: Document[] = [];

  for (const doc of docs) {
    if (doc.type === "cni_recto") rectos.push(doc);
    else if (doc.type === "cni_verso") versos.push(doc);
    else others.push(doc);
  }

  const usedVersoIds = new Set<string>();
  const grouped: GroupedDocument[] = [];

  for (const recto of rectos) {
    // Cherche le verso le plus proche du même tenant / lease
    const match = versos.find(
      (v) =>
        !usedVersoIds.has(v.id) &&
        ((recto.tenant_id && v.tenant_id && recto.tenant_id === v.tenant_id) ||
          (recto.lease_id && v.lease_id && recto.lease_id === v.lease_id))
    );

    if (match) {
      usedVersoIds.add(match.id);
      grouped.push({
        id: recto.id,
        group_type: "cni",
        recto,
        verso: match,
        tenant_id: recto.tenant_id,
        lease_id: recto.lease_id,
        created_at: recto.created_at,
      });
    } else {
      // Pas de verso trouvé → recto seul dans un groupe incomplet
      grouped.push({
        id: recto.id,
        group_type: "cni",
        recto,
        verso: null,
        tenant_id: recto.tenant_id,
        lease_id: recto.lease_id,
        created_at: recto.created_at,
      });
    }
  }

  // Versos non appariés restent comme documents individuels
  const unpairedVersos = versos.filter((v) => !usedVersoIds.has(v.id));

  return [...others, ...grouped, ...unpairedVersos];
}

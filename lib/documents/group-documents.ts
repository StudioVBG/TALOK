import type { Document, DocumentType } from "@/lib/types";

/**
 * A grouped document (e.g. CNI recto + verso merged into one card).
 * Extends the base Document with group metadata.
 */
export interface GroupedDocument extends Document {
  group_type: "cni";
  grouped_docs: Document[];
}

export type DisplayDocument = Document | GroupedDocument;

/** Document types that should be paired together. */
const GROUP_PAIRS: Record<string, { pair: DocumentType; groupType: "cni" }> = {
  cni_recto: { pair: "cni_verso" as DocumentType, groupType: "cni" },
  cni_verso: { pair: "cni_recto" as DocumentType, groupType: "cni" },
};

/**
 * Groups related documents (e.g. CNI recto + verso) into single display items.
 * Non-groupable documents pass through unchanged.
 */
export function groupDocuments(documents: Document[]): DisplayDocument[] {
  const grouped = new Set<string>();
  const result: DisplayDocument[] = [];

  for (const doc of documents) {
    if (grouped.has(doc.id)) continue;

    const pairConfig = GROUP_PAIRS[doc.type];
    if (!pairConfig) {
      result.push(doc);
      continue;
    }

    // Find the matching pair (same owner/tenant/property/lease scope)
    const pair = documents.find(
      (d) =>
        d.id !== doc.id &&
        !grouped.has(d.id) &&
        d.type === pairConfig.pair &&
        d.owner_id === doc.owner_id &&
        d.tenant_id === doc.tenant_id &&
        d.property_id === doc.property_id &&
        d.lease_id === doc.lease_id
    );

    if (pair) {
      grouped.add(doc.id);
      grouped.add(pair.id);

      // Use the recto as the "primary" document
      const recto = doc.type === "cni_recto" ? doc : pair;
      const verso = doc.type === "cni_verso" ? doc : pair;

      result.push({
        ...recto,
        group_type: pairConfig.groupType,
        title: "Carte d'identit\u00e9",
        grouped_docs: [recto, verso],
      });
    } else {
      // No pair found — render as standalone
      result.push(doc);
    }
  }

  return result;
}

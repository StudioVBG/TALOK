import { GROUPED_DOCUMENT_TYPES, type DocumentGroup } from "@/lib/documents/constants";

export interface DocumentLike {
  id: string;
  type: string;
  title?: string | null;
  storage_path?: string | null;
  created_at?: string | null;
}

export interface GroupedDocumentItem {
  kind: "single" | "group";
  /** Pour single: le document. Pour group: undefined */
  document?: DocumentLike;
  /** Pour group: la config du groupe */
  group?: DocumentGroup;
  /** Pour group: les documents qui composent le groupe */
  parts?: DocumentLike[];
  /** Cle unique pour React key */
  key: string;
  /** Label affiche */
  label: string;
  /** Date la plus recente du groupe */
  latestDate?: string | null;
}

/**
 * Groupe les documents selon GROUPED_DOCUMENT_TYPES.
 * Les paires CNI recto/verso deviennent une seule entree dans la liste.
 * Les documents non-groupes restent tels quels.
 */
export function groupDocuments<T extends DocumentLike>(documents: T[]): GroupedDocumentItem[] {
  const result: GroupedDocumentItem[] = [];
  const consumed = new Set<string>();

  for (const groupDef of GROUPED_DOCUMENT_TYPES) {
    const parts = groupDef.parts
      .map((partType) => documents.find((d) => d.type === partType && !consumed.has(d.id)))
      .filter(Boolean) as DocumentLike[];

    if (parts.length > 0) {
      parts.forEach((p) => consumed.add(p.id));

      const dates = parts.map((p) => p.created_at).filter(Boolean) as string[];
      const latestDate = dates.length > 0 ? dates.sort().reverse()[0] : null;

      result.push({
        kind: "group",
        group: groupDef,
        parts,
        key: `group-${groupDef.group}`,
        label: groupDef.label,
        latestDate,
      });
    }
  }

  for (const doc of documents) {
    if (!consumed.has(doc.id)) {
      result.push({
        kind: "single",
        document: doc,
        key: `doc-${doc.id}`,
        label: doc.title || doc.type,
        latestDate: doc.created_at,
      });
    }
  }

  result.sort((a, b) => {
    const dateA = a.latestDate ? new Date(a.latestDate).getTime() : 0;
    const dateB = b.latestDate ? new Date(b.latestDate).getTime() : 0;
    return dateB - dateA;
  });

  return result;
}

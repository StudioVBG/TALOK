/**
 * Serialise un objet JSON-LD pour insertion dans un <script type="application/ld+json">
 * via dangerouslySetInnerHTML.
 *
 * JSON.stringify n'echappe PAS le caractere "<", donc si une valeur contient
 * "</script>" (improbable mais possible si une donnee user remonte), le
 * navigateur ferme prematurement la balise script et le reste du contenu
 * devient du HTML execute -> XSS.
 *
 * Le fix standard : remplacer "<" par "<". Le JSON reste valide et le
 * navigateur ne peut plus etre trompe.
 *
 * Voir https://html.spec.whatwg.org/multipage/scripting.html#restrictions-for-contents-of-script-elements
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

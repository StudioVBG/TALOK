import { describe, expect, it } from "vitest";
import { safeJsonLd } from "@/lib/seo/safe-json-ld";

describe("safeJsonLd", () => {
  it("serialise un objet JSON-LD simple sans modification visible", () => {
    const obj = { "@context": "https://schema.org", "@type": "Organization", name: "Talok" };
    const result = safeJsonLd(obj);
    expect(JSON.parse(result)).toEqual(obj);
  });

  it("echappe les '<' pour empecher un breakout de balise script", () => {
    // Cas critique : si une valeur contient "</script>", JSON.stringify la
    // serialise tel quel et le navigateur ferme prematurement la balise.
    // safeJsonLd doit transformer "<" en "<".
    const malicious = { description: "Hello </script><script>alert(1)</script>" };
    const result = safeJsonLd(malicious);

    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script\\u003e");
    // Le JSON reste parseable cote client
    expect(JSON.parse(result)).toEqual(malicious);
  });

  it("echappe TOUS les '<' meme dans des contextes benins", () => {
    const obj = { name: "1 < 2 et 3 > 2" };
    const result = safeJsonLd(obj);

    expect(result).not.toMatch(/(?<!\\u003c)</);
    expect(JSON.parse(result)).toEqual(obj);
  });

  it("ne modifie pas '>' (pas necessaire pour la securite)", () => {
    const obj = { value: "a>b" };
    const result = safeJsonLd(obj);
    expect(result).toContain(">");
  });

  it("gere les valeurs imbriquees (arrays, objets)", () => {
    const obj = {
      offers: [
        { name: "<script>", price: 10 },
        { name: "normal", price: 20 },
      ],
    };
    const result = safeJsonLd(obj);
    expect(result).not.toContain("<script>");
    expect(JSON.parse(result)).toEqual(obj);
  });

  it("gere null, undefined, boolean, number", () => {
    expect(safeJsonLd(null)).toBe("null");
    expect(safeJsonLd(true)).toBe("true");
    expect(safeJsonLd(42)).toBe("42");
    // undefined est serialise en undefined par JSON.stringify (retourne undefined),
    // mais on l'appelle ici pour s'assurer qu'on ne crash pas.
    expect(safeJsonLd(undefined)).toBeUndefined();
  });
});

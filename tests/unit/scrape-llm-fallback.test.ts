/**
 * Tests unitaires du fallback LLM /api/scrape — `app/api/scrape/llm-fallback.ts`.
 *
 * On teste séparément les trois pièces déterministes :
 *   - shouldUseLlmFallback : la décision de déclencher (score < 40 ou
 *     core fields manquants).
 *   - prepareTextForLlm : la compaction de texte avant envoi au modèle.
 *   - mergeLlmIntoBase : la règle "le rule-based est prioritaire, le LLM
 *     ne remplit que les vides".
 *
 * L'appel réseau OpenAI lui-même est testé via un mock du module `openai`
 * pour vérifier le contrat (response_format, JSON parse, fallback gracieux).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedData } from "@/app/api/scrape/extractors";
import {
  __resetClientCache,
  extractWithLlm,
  mergeLlmIntoBase,
  prepareTextForLlm,
  shouldUseLlmFallback,
} from "@/app/api/scrape/llm-fallback";

// Construit un ExtractedData "vide mais valide" pour les tests de fusion/score.
function makeBase(overrides: Partial<ExtractedData> = {}): ExtractedData {
  return {
    titre: "",
    description: "",
    loyer_hc: null,
    loyer_cc: null,
    charges: null,
    surface: null,
    nb_pieces: null,
    nb_chambres: null,
    type: "appartement",
    code_postal: null,
    ville: null,
    adresse: null,
    adresse_complete: null,
    meuble: null,
    dpe_classe_energie: null,
    dpe_ges: null,
    dpe_valeur: null,
    chauffage_type: null,
    chauffage_mode: null,
    etage: null,
    nb_etages: null,
    ascenseur: null,
    balcon: false,
    terrasse: false,
    parking_inclus: false,
    cave: false,
    climatisation: false,
    jardin: false,
    piscine: false,
    annee_construction: null,
    photos: [],
    cover_url: null,
    visite_virtuelle_url: null,
    source_url: "https://example.com/x",
    source_site: "generic",
    extraction_quality: { source: "generic", score: 0, details: [] },
    ...overrides,
  };
}

describe("shouldUseLlmFallback", () => {
  it("déclenche le fallback quand le score est < 40", () => {
    const base = makeBase({
      loyer_hc: 800,
      surface: 50,
      ville: "Paris",
      extraction_quality: { source: "generic", score: 30, details: [] },
    });
    expect(shouldUseLlmFallback(base)).toBe(true);
  });

  it("ne déclenche pas si le score est ≥ 40", () => {
    const base = makeBase({
      loyer_hc: 800,
      surface: 50,
      ville: "Paris",
      extraction_quality: { source: "generic", score: 60, details: [] },
    });
    expect(shouldUseLlmFallback(base)).toBe(false);
  });

  it("déclenche si loyer + surface + ville sont tous absents", () => {
    const base = makeBase({
      extraction_quality: { source: "generic", score: 80, details: [] },
    });
    expect(shouldUseLlmFallback(base)).toBe(true);
  });

  it("ne déclenche pas si au moins un des 3 essentiels est présent et score OK", () => {
    const base = makeBase({
      ville: "Lyon",
      extraction_quality: { source: "generic", score: 50, details: [] },
    });
    expect(shouldUseLlmFallback(base)).toBe(false);
  });
});

describe("prepareTextForLlm", () => {
  it("compacte les espaces multiples", () => {
    expect(prepareTextForLlm("hello    world\n\n\tfoo")).toBe("hello world foo");
  });

  it("strippe les bandeaux cookies/tracking", () => {
    const input =
      "Annonce : T2 60m². Cookies sont utilisés pour mesurer l'audience. Loyer 800€";
    const output = prepareTextForLlm(input);
    expect(output.toLowerCase()).not.toContain("cookies sont");
    expect(output).toContain("Loyer 800€");
  });

  it("tronque à 30 000 caractères max", () => {
    const huge = "a".repeat(50_000);
    const output = prepareTextForLlm(huge);
    expect(output.length).toBe(30_000);
  });

  it("conserve un texte court inchangé (hors compaction d'espaces)", () => {
    expect(prepareTextForLlm("T3 65m² Paris 75011 850€/mois")).toBe(
      "T3 65m² Paris 75011 850€/mois"
    );
  });
});

describe("mergeLlmIntoBase", () => {
  it("remplit uniquement les champs null/vides côté base", () => {
    const base = makeBase({
      loyer_hc: 850,
      surface: null,
      ville: null,
    });
    const llm = {
      loyer_hc: 9999, // ne doit PAS écraser 850 (rule-based prioritaire)
      surface: 60,
      ville: "Marseille",
    };
    const { merged, filledFields } = mergeLlmIntoBase(base, llm);
    expect(merged.loyer_hc).toBe(850);
    expect(merged.surface).toBe(60);
    expect(merged.ville).toBe("Marseille");
    expect(filledFields).toEqual(expect.arrayContaining(["surface", "ville"]));
    expect(filledFields).not.toContain("loyer_hc");
  });

  it("ignore les champs LLM null ou undefined", () => {
    const base = makeBase();
    const { merged, filledFields } = mergeLlmIntoBase(base, {
      surface: null,
      ville: undefined,
      nb_pieces: 3,
    });
    expect(merged.nb_pieces).toBe(3);
    expect(filledFields).toEqual(["nb_pieces"]);
  });

  it("remplace un booléen false par true si le LLM affirme true", () => {
    const base = makeBase({ balcon: false, terrasse: false });
    const { merged, filledFields } = mergeLlmIntoBase(base, {
      balcon: true,
      // terrasse absente: pas de changement
    });
    expect(merged.balcon).toBe(true);
    expect(merged.terrasse).toBe(false);
    expect(filledFields).toContain("balcon");
    expect(filledFields).not.toContain("terrasse");
  });

  it("ne remplace jamais un booléen true par false", () => {
    const base = makeBase({ balcon: true });
    const { merged, filledFields } = mergeLlmIntoBase(base, { balcon: false });
    expect(merged.balcon).toBe(true);
    expect(filledFields).not.toContain("balcon");
  });

  it("renseigne plusieurs champs en un seul appel", () => {
    const base = makeBase();
    const { merged, filledFields } = mergeLlmIntoBase(base, {
      loyer_hc: 950,
      surface: 45,
      nb_pieces: 2,
      ville: "Toulouse",
      code_postal: "31000",
      dpe_classe_energie: "D",
    });
    expect(merged.loyer_hc).toBe(950);
    expect(merged.dpe_classe_energie).toBe("D");
    expect(filledFields).toHaveLength(6);
  });
});

describe("extractWithLlm (mock OpenAI)", () => {
  const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
  const ORIGINAL_MODEL = process.env.OPENAI_MODEL_INSTANT;

  beforeEach(() => {
    __resetClientCache();
    vi.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
    if (ORIGINAL_MODEL === undefined) delete process.env.OPENAI_MODEL_INSTANT;
    else process.env.OPENAI_MODEL_INSTANT = ORIGINAL_MODEL;
    __resetClientCache();
    vi.restoreAllMocks();
  });

  it("renvoie null sans clé OPENAI_API_KEY (fallback gracieux)", async () => {
    delete process.env.OPENAI_API_KEY;
    __resetClientCache();
    const result = await extractWithLlm("T3 65m² Paris 850€", {
      url: "https://x.fr/y",
      site: "generic",
    });
    expect(result).toBeNull();
  });

  it("renvoie null si le texte est trop court (<200 chars)", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    __resetClientCache();
    const result = await extractWithLlm("trop court", {
      url: "https://x.fr/y",
      site: "generic",
    });
    expect(result).toBeNull();
  });

  it("appelle OpenAI avec le bon modèle et retourne le JSON parsé", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL_INSTANT = "gpt-5.2-instant-test";

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              loyer_hc: 850,
              surface: 65,
              ville: "Paris",
              code_postal: "75011",
              type: "appartement",
            }),
          },
        },
      ],
    });

    vi.doMock("openai", () => ({
      default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      })),
    }));

    // Re-import pour bénéficier du mock
    const mod = await import("@/app/api/scrape/llm-fallback");
    mod.__resetClientCache();

    const longText =
      "Annonce : appartement T3 de 65 m² situé à Paris 11ème, " +
      "loyer 850€ hors charges, charges 50€. ".repeat(15);

    const result = await mod.extractWithLlm(longText, {
      url: "https://example.com/listing/1",
      site: "generic",
    });

    expect(result).toEqual({
      loyer_hc: 850,
      surface: 65,
      ville: "Paris",
      code_postal: "75011",
      type: "appartement",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-5.2-instant-test");
    expect(callArgs.temperature).toBe(0);
    expect(callArgs.response_format.type).toBe("json_schema");
    expect(callArgs.response_format.json_schema.strict).toBe(true);
    // Le prompt utilisateur doit contenir l'URL et le site source
    const userMsg = callArgs.messages.find((m: any) => m.role === "user");
    expect(userMsg.content).toContain("example.com/listing/1");
    expect(userMsg.content).toContain("generic");
  });

  it("renvoie null et n'explose pas si OpenAI lève une erreur", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const mockCreate = vi.fn().mockRejectedValue(new Error("rate limit"));
    vi.doMock("openai", () => ({
      default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      })),
    }));

    const mod = await import("@/app/api/scrape/llm-fallback");
    mod.__resetClientCache();

    const longText = "Annonce d'un appartement à louer. ".repeat(20);
    const result = await mod.extractWithLlm(longText, {
      url: "https://x.fr/y",
      site: "generic",
    });

    expect(result).toBeNull();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("renvoie null si le contenu est vide ou non JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const mockCreate = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });
    vi.doMock("openai", () => ({
      default: vi.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      })),
    }));

    const mod = await import("@/app/api/scrape/llm-fallback");
    mod.__resetClientCache();

    const longText = "Annonce d'un appartement à louer. ".repeat(20);
    const result = await mod.extractWithLlm(longText, {
      url: "https://x.fr/y",
      site: "generic",
    });
    expect(result).toBeNull();
  });
});

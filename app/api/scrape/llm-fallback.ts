/**
 * Fallback LLM pour /api/scrape — extraction structurée via OpenAI.
 *
 * Quand l'extracteur rule-based renvoie un score faible (HTML exotique, page
 * d'agence non standard, etc.), on demande à GPT-5.2 Instant d'extraire les
 * mêmes champs depuis le texte brut de l'annonce. Le résultat est ensuite
 * fusionné dans le payload — uniquement pour les champs encore null/vides
 * côté rule-based, jamais en remplacement.
 *
 * Conventions du projet :
 *   - process.env.OPENAI_API_KEY (cf. lib/ai/voice/whisper.service.ts)
 *   - process.env.OPENAI_MODEL_INSTANT (cf. lib/ai/config.ts)
 *   - Si la clé manque, le module renvoie null et le scraper continue sans
 *     fallback (comportement gracieux, pas d'erreur 500).
 */

import OpenAI from "openai";
import type { ExtractedData } from "./extractors";

/**
 * Sous-ensemble de ExtractedData que le LLM peut renseigner. On exclut
 * volontairement les champs calculés par route.ts (extraction_quality,
 * source_url, source_site, adresse_complete, cover_url) et les champs
 * média (photos, visite_virtuelle_url) qui nécessitent du DOM.
 */
export type LlmExtraction = Partial<
  Pick<
    ExtractedData,
    | "titre"
    | "description"
    | "loyer_hc"
    | "loyer_cc"
    | "charges"
    | "surface"
    | "nb_pieces"
    | "nb_chambres"
    | "type"
    | "code_postal"
    | "ville"
    | "adresse"
    | "meuble"
    | "dpe_classe_energie"
    | "dpe_ges"
    | "etage"
    | "ascenseur"
    | "balcon"
    | "terrasse"
    | "cave"
    | "jardin"
    | "chauffage_type"
    | "chauffage_mode"
    | "annee_construction"
  >
>;

const SYSTEM_PROMPT = `Tu es un extracteur de données pour des annonces immobilières françaises (location).

Tu reçois le texte brut d'une annonce. Renvoie un JSON conforme au schéma fourni.

Règles strictes :
- Tous les montants en EUROS (entiers, sans symbole). Le loyer hors charges (loyer_hc) DOIT exclure les charges.
- Surface en m² (entier).
- Code postal français : 5 chiffres exactement (DROM acceptés : 971XX-976XX).
- DPE et GES : une seule lettre A à G en majuscule, sinon null.
- Type : appartement, maison, studio, colocation, parking, local_commercial, bureaux, autre.
- chauffage_type : énergie (gaz, electrique, fioul, bois, pac), null si inconnu.
- chauffage_mode : individuel ou collectif, null si inconnu.
- Si une information n'est pas explicitement présente dans le texte, mets null. NE DEVINE JAMAIS.
- Pour les booléens (balcon, terrasse, cave, jardin, ascenseur, meuble), mets true uniquement si mentionné explicitement, false ou null sinon.`;

const JSON_SCHEMA = {
  name: "listing_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      titre: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      type: {
        type: ["string", "null"],
        enum: [
          "appartement",
          "maison",
          "studio",
          "colocation",
          "parking",
          "local_commercial",
          "bureaux",
          "autre",
          null,
        ],
      },
      loyer_hc: { type: ["integer", "null"] },
      loyer_cc: { type: ["integer", "null"] },
      charges: { type: ["integer", "null"] },
      surface: { type: ["integer", "null"] },
      nb_pieces: { type: ["integer", "null"] },
      nb_chambres: { type: ["integer", "null"] },
      code_postal: { type: ["string", "null"] },
      ville: { type: ["string", "null"] },
      adresse: { type: ["string", "null"] },
      meuble: { type: ["boolean", "null"] },
      dpe_classe_energie: {
        type: ["string", "null"],
        enum: ["A", "B", "C", "D", "E", "F", "G", null],
      },
      dpe_ges: {
        type: ["string", "null"],
        enum: ["A", "B", "C", "D", "E", "F", "G", null],
      },
      etage: { type: ["integer", "null"] },
      ascenseur: { type: ["boolean", "null"] },
      balcon: { type: ["boolean", "null"] },
      terrasse: { type: ["boolean", "null"] },
      cave: { type: ["boolean", "null"] },
      jardin: { type: ["boolean", "null"] },
      chauffage_type: {
        type: ["string", "null"],
        enum: ["gaz", "electrique", "fioul", "bois", "pac", null],
      },
      chauffage_mode: {
        type: ["string", "null"],
        enum: ["individuel", "collectif", null],
      },
      annee_construction: { type: ["integer", "null"] },
    },
    required: [
      "titre",
      "description",
      "type",
      "loyer_hc",
      "loyer_cc",
      "charges",
      "surface",
      "nb_pieces",
      "nb_chambres",
      "code_postal",
      "ville",
      "adresse",
      "meuble",
      "dpe_classe_energie",
      "dpe_ges",
      "etage",
      "ascenseur",
      "balcon",
      "terrasse",
      "cave",
      "jardin",
      "chauffage_type",
      "chauffage_mode",
      "annee_construction",
    ],
  },
} as const;

const MAX_INPUT_CHARS = 30_000; // ~7-8k tokens, large mais cap pour borner le coût.

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

/**
 * Réduit un texte brut d'annonce avant envoi au LLM : compaction des espaces,
 * suppression du chrome de page (cookies, footer, mentions légales), borne
 * dure à MAX_INPUT_CHARS.
 *
 * Exporté pour les tests unitaires.
 */
export function prepareTextForLlm(text: string): string {
  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/cookies?\s+(?:nous|sont|servent)[^.]{0,200}\./gi, "")
    .trim();
  if (cleaned.length > MAX_INPUT_CHARS) {
    cleaned = cleaned.slice(0, MAX_INPUT_CHARS);
  }
  return cleaned;
}

/**
 * Fusionne `llm` dans `base` en ne renseignant que les champs encore null,
 * undefined ou chaîne vide côté `base`. Le rule-based reste prioritaire :
 * le LLM n'écrase JAMAIS une donnée déjà extraite par les sélecteurs DOM.
 *
 * Exporté pour les tests unitaires.
 */
export function mergeLlmIntoBase(
  base: ExtractedData,
  llm: LlmExtraction
): { merged: ExtractedData; filledFields: string[] } {
  const filled: string[] = [];
  const merged = { ...base };

  for (const [key, value] of Object.entries(llm) as Array<
    [keyof LlmExtraction, LlmExtraction[keyof LlmExtraction]]
  >) {
    if (value === null || value === undefined) continue;
    const current = (merged as Record<string, unknown>)[key];
    const isEmpty =
      current === null ||
      current === undefined ||
      current === "" ||
      (typeof current === "boolean" && current === false && typeof value === "boolean");
    // Pour les booléens, on remplace false par true si le LLM dit true (les
    // false du rule-based sont des défauts, pas des affirmations).
    const shouldFill =
      typeof value === "boolean"
        ? value === true && current !== true
        : isEmpty || current === null || current === undefined || current === "";
    if (shouldFill) {
      (merged as Record<string, unknown>)[key] = value;
      filled.push(key);
    }
  }

  return { merged, filledFields: filled };
}

/**
 * Décide si le rule-based mérite un renfort LLM. Critères :
 *   - score < 40 (extraction faible)
 *   - OU absence simultanée de loyer ET surface ET ville (les 3 essentiels).
 */
export function shouldUseLlmFallback(data: ExtractedData): boolean {
  if (data.extraction_quality?.score != null && data.extraction_quality.score < 40) {
    return true;
  }
  const missingCore = !data.loyer_hc && !data.surface && !data.ville;
  return missingCore;
}

/**
 * Appelle OpenAI pour extraire les champs de l'annonce. Renvoie null si la
 * clé API n'est pas configurée ou si l'appel échoue (fallback gracieux —
 * l'import continue avec les données rule-based seules).
 */
export async function extractWithLlm(
  rawText: string,
  context: { url: string; site: string }
): Promise<LlmExtraction | null> {
  const cleanedText = prepareTextForLlm(rawText);
  if (cleanedText.length < 200) {
    // Pas assez de matière pour un fallback utile — on évite aussi
    // d'instancier le client OpenAI inutilement.
    return null;
  }

  const client = getClient();
  if (!client) {
    return null;
  }

  const model = process.env.OPENAI_MODEL_INSTANT || "gpt-5.2-instant";

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1200,
      response_format: {
        type: "json_schema",
        json_schema: JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `URL : ${context.url}\nSite source : ${context.site}\n\n--- Texte de l'annonce ---\n${cleanedText}`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LlmExtraction;
  } catch (error) {
    console.warn(
      "[Scrape/LLM] Fallback OpenAI échoué:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/** @internal — pour les tests */
export function __resetClientCache() {
  cachedClient = null;
}

/** @internal — pour les tests */
export function __setClientForTests(client: OpenAI | null) {
  cachedClient = client;
}

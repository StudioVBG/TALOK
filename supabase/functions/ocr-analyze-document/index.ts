// Edge Function: OCR + IA analysis for accounting documents
// Deploy: supabase functions deploy ocr-analyze-document

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OCR_SYSTEM_PROMPT = `Tu es un assistant comptable specialise dans l'immobilier francais.
Analyse le document fourni (facture, quittance, releve, avis d'imposition, etc.)
et retourne un JSON STRICT avec les champs suivants :
{
  "document_type": "facture|quittance|releve_bancaire|avis_impot|contrat|autre",
  "emetteur": { "nom": "string", "siret": "string|null", "adresse": "string|null" },
  "destinataire": { "nom": "string", "adresse": "string|null" },
  "date_document": "YYYY-MM-DD",
  "date_echeance": "YYYY-MM-DD|null",
  "numero_document": "string|null",
  "montant_ht_cents": 0,
  "montant_tva_cents": 0,
  "taux_tva_percent": 0,
  "montant_ttc_cents": 0,
  "devise": "EUR",
  "lignes": [{ "description": "string", "quantite": 1, "prix_unitaire_cents": 0, "montant_cents": 0 }],
  "suggested_account": "6xxxxx",
  "suggested_journal": "ACH|VE|BQ|OD",
  "suggested_label": "string",
  "alerts": ["string"],
  "confidence": 0.95
}
REGLES: Tous montants en CENTIMES. SIRET 14 chiffres. TVA coherence HT+TVA=TTC. Si illisible confidence < 0.5.`;

const TVA_RATES: Record<string, Record<string, number>> = {
  metropole: { normal: 20, intermediaire: 10, reduit: 5.5, super_reduit: 2.1 },
  martinique: { normal: 8.5, intermediaire: 8.5, reduit: 2.1, super_reduit: 1.05 },
  guadeloupe: { normal: 8.5, intermediaire: 8.5, reduit: 2.1, super_reduit: 1.05 },
  reunion: { normal: 8.5, intermediaire: 8.5, reduit: 2.1, super_reduit: 1.05 },
  guyane: { normal: 0, intermediaire: 0, reduit: 0, super_reduit: 0 },
  mayotte: { normal: 0, intermediaire: 0, reduit: 0, super_reduit: 0 },
};

function validateTVACoherence(
  htCents: number, tvaCents: number, ttcCents: number,
  tauxPercent: number, territory: string,
): { coherent: boolean; alerts: string[] } {
  const alerts: string[] = [];
  const rates = TVA_RATES[territory] || TVA_RATES.metropole;
  const validRates = Object.values(rates);

  if (Math.abs(htCents + tvaCents - ttcCents) > 1) {
    alerts.push(`Incohérence montants: HT(${htCents}) + TVA(${tvaCents}) != TTC(${ttcCents})`);
  }
  if (tauxPercent > 0 && !validRates.includes(tauxPercent)) {
    alerts.push(`Taux TVA ${tauxPercent}% non standard pour ${territory} (attendu: ${validRates.join(", ")}%)`);
  }
  if (htCents > 0 && tauxPercent > 0) {
    const expectedTva = Math.round(htCents * (tauxPercent / 100));
    if (Math.abs(expectedTva - tvaCents) > Math.max(2, htCents * 0.005)) {
      alerts.push(`TVA déclarée (${tvaCents}) diverge du calcul HT*taux (${expectedTva})`);
    }
  }
  return { coherent: alerts.length === 0, alerts };
}

// deno-lint-ignore no-explicit-any
async function callGPT(apiKey: string, userContent: any): Promise<any> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 2048,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI API error ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content);
}

async function verifySiret(siret: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://api.insee.fr/api-sirene/3.11/siret/${siret}`,
      { headers: { Authorization: `Bearer ${Deno.env.get("INSEE_API_TOKEN") ?? ""}` } },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let documentId: string | undefined;

  try {
    const { documentId: docId, entityId, territory = "metropole" } = await req.json();
    documentId = docId;

    if (!documentId || !entityId) {
      return jsonResponse({ error: "documentId et entityId requis" }, 400);
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY non configurée");

    // 1. Fetch document metadata
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, storage_path, mime_type")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) throw new Error(`Document introuvable: ${docErr?.message ?? documentId}`);

    // 2. Download file from Storage
    const { data: fileData, error: dlErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlErr || !fileData) throw new Error(`Téléchargement échoué: ${dlErr?.message}`);

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const mime = (doc.mime_type ?? "").toLowerCase();

    // 3. Analyze with GPT-4o-mini
    // deno-lint-ignore no-explicit-any
    let gptResult: any;

    if (mime === "application/pdf") {
      const textContent = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let extracted = "";
      let match;
      while ((match = streamRegex.exec(textContent)) !== null) {
        const chunk = match[1].replace(/[^\x20-\x7E\xC0-\xFF\n]/g, " ");
        if (chunk.trim().length > 10) extracted += chunk + "\n";
      }
      if (extracted.trim().length < 50) {
        extracted = textContent.replace(/[^\x20-\x7E\xC0-\xFF\n]/g, " ")
          .replace(/\s{3,}/g, "\n").trim();
      }
      gptResult = await callGPT(openaiKey, `Analyse ce document comptable:\n\n${extracted.slice(0, 8000)}`);
    } else if (mime.startsWith("image/")) {
      const base64 = btoa(bytes.reduce((s, b) => s + String.fromCharCode(b), ""));
      gptResult = await callGPT(openaiKey, [
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
        { type: "text", text: "Analyse ce document comptable." },
      ]);
    } else {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      gptResult = await callGPT(openaiKey, `Analyse ce document comptable:\n\n${text.slice(0, 8000)}`);
    }

    // 4. Verify SIRET if detected
    let siretVerified = false;
    const siret = gptResult.emetteur?.siret;
    if (siret && /^\d{14}$/.test(siret)) {
      siretVerified = await verifySiret(siret);
    }

    // 5. Validate TVA coherence
    const tvaCheck = validateTVACoherence(
      gptResult.montant_ht_cents ?? 0, gptResult.montant_tva_cents ?? 0,
      gptResult.montant_ttc_cents ?? 0, gptResult.taux_tva_percent ?? 0, territory,
    );
    if (tvaCheck.alerts.length > 0) {
      gptResult.alerts = [...(gptResult.alerts ?? []), ...tvaCheck.alerts];
    }

    // 6. Check existing OCR category rules
    let suggestedAccount = gptResult.suggested_account;
    let suggestedJournal = gptResult.suggested_journal;
    try {
      const { data: rules } = await supabase
        .from("ocr_category_rules")
        .select("account_code, journal_code")
        .eq("entity_id", entityId)
        .ilike("emetteur_pattern", `%${gptResult.emetteur?.nom ?? ""}%`)
        .limit(1);
      if (rules && rules.length > 0) {
        suggestedAccount = rules[0].account_code ?? suggestedAccount;
        suggestedJournal = rules[0].journal_code ?? suggestedJournal;
      }
    } catch {
      // ocr_category_rules table may not exist yet
    }

    // 7. Update document_analyses
    const confidence = gptResult.confidence ?? 0;
    const { data: analysis, error: updErr } = await supabase
      .from("document_analyses")
      .update({
        processing_status: "completed",
        extracted_data: gptResult,
        confidence_score: confidence,
        suggested_account: suggestedAccount,
        suggested_journal: suggestedJournal,
        document_type: gptResult.document_type,
        siret_verified: siretVerified,
        tva_coherent: tvaCheck.coherent,
      })
      .eq("document_id", documentId)
      .select("id")
      .single();
    if (updErr) throw new Error(`Mise à jour analyse échouée: ${updErr.message}`);

    // 8. Return result
    return jsonResponse({
      analysisId: analysis.id,
      confidence_score: confidence,
      document_type: gptResult.document_type,
      suggested_entry: {
        account: suggestedAccount,
        journal: suggestedJournal,
        label: gptResult.suggested_label,
        montant_ttc_cents: gptResult.montant_ttc_cents,
        montant_ht_cents: gptResult.montant_ht_cents,
        montant_tva_cents: gptResult.montant_tva_cents,
      },
      siret_verified: siretVerified,
      tva_coherent: tvaCheck.coherent,
      alerts: gptResult.alerts ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ocr-analyze-document error:", message);

    if (documentId) {
      try {
        await supabase
          .from("document_analyses")
          .update({ processing_status: "failed", extracted_data: { error: message } })
          .eq("document_id", documentId);
      } catch (e) {
        console.error("Failed to update error status:", e);
      }
    }
    return jsonResponse({ error: message }, 500);
  }
});

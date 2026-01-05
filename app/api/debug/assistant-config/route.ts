export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API de diagnostic pour l'Assistant IA
 * GET /api/debug/assistant-config
 *
 * Vérifie la configuration et les tables nécessaires
 * SECURITE: Route désactivée en production
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDevOnly, prodDisabledResponse } from "@/app/api/_lib/supabase";

export async function GET() {
  // Bloquer en production
  if (!isDevOnly()) {
    return prodDisabledResponse();
  }
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
    errors: [],
    recommendations: [],
  };

  // 1. Vérifier OPENAI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    (diagnostics.checks as Record<string, unknown>).openai_key = {
      status: "error",
      message: "OPENAI_API_KEY non définie",
    };
    (diagnostics.errors as string[]).push("OPENAI_API_KEY manquante");
    (diagnostics.recommendations as string[]).push(
      "Ajoutez OPENAI_API_KEY=sk-xxx dans .env.local"
    );
  } else if (!openaiKey.startsWith("sk-")) {
    (diagnostics.checks as Record<string, unknown>).openai_key = {
      status: "error",
      message: "OPENAI_API_KEY invalide (doit commencer par 'sk-')",
    };
    (diagnostics.errors as string[]).push("OPENAI_API_KEY invalide");
  } else {
    (diagnostics.checks as Record<string, unknown>).openai_key = {
      status: "ok",
      message: `Configurée (${openaiKey.substring(0, 7)}...${openaiKey.substring(openaiKey.length - 4)})`,
    };
  }

  // 2. Vérifier OPENAI_MODEL
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o";
  (diagnostics.checks as Record<string, unknown>).openai_model = {
    status: "ok",
    message: openaiModel,
  };

  // 3. Vérifier les variables Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    (diagnostics.checks as Record<string, unknown>).supabase_config = {
      status: "error",
      message: "Variables Supabase manquantes",
    };
    (diagnostics.errors as string[]).push("Configuration Supabase incomplète");
    return NextResponse.json(diagnostics, { status: 503 });
  }

  // 4. Vérifier les tables Supabase (avec client anonyme)
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Vérifier assistant_threads
    const { error: threadsError } = await supabase
      .from("assistant_threads")
      .select("id")
      .limit(1);

    if (threadsError) {
      const isTableMissing = threadsError.message?.includes("does not exist");
      (diagnostics.checks as Record<string, unknown>).table_assistant_threads = {
        status: "error",
        message: isTableMissing
          ? "Table n'existe pas"
          : threadsError.message,
        code: threadsError.code,
      };
      if (isTableMissing) {
        (diagnostics.errors as string[]).push("Table assistant_threads manquante");
        (diagnostics.recommendations as string[]).push(
          "Appliquez la migration: supabase/migrations/20251206800000_assistant_ai_tables.sql"
        );
      }
    } else {
      (diagnostics.checks as Record<string, unknown>).table_assistant_threads = {
        status: "ok",
        message: "Table existe",
      };
    }

    // Vérifier assistant_messages
    const { error: messagesError } = await supabase
      .from("assistant_messages")
      .select("id")
      .limit(1);

    if (messagesError) {
      const isTableMissing = messagesError.message?.includes("does not exist");
      (diagnostics.checks as Record<string, unknown>).table_assistant_messages = {
        status: "error",
        message: isTableMissing
          ? "Table n'existe pas"
          : messagesError.message,
        code: messagesError.code,
      };
      if (isTableMissing) {
        (diagnostics.errors as string[]).push("Table assistant_messages manquante");
      }
    } else {
      (diagnostics.checks as Record<string, unknown>).table_assistant_messages = {
        status: "ok",
        message: "Table existe",
      };
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    (diagnostics.checks as Record<string, unknown>).supabase = {
      status: "error",
      message: errorMessage,
    };
    (diagnostics.errors as string[]).push(`Erreur Supabase: ${errorMessage}`);
  }

  // Résumé
  const errors = diagnostics.errors as string[];
  diagnostics.summary = {
    status: errors.length === 0 ? "ready" : "needs_configuration",
    error_count: errors.length,
    message: errors.length === 0
      ? "✅ L'assistant IA est prêt à fonctionner"
      : `❌ ${errors.length} problème(s) à résoudre`,
  };

  return NextResponse.json(diagnostics, {
    status: errors.length === 0 ? 200 : 503,
  });
}


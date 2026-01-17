/**
 * Script de diagnostic pour vérifier toutes les routes API et connexions aux données
 * 
 * Usage: npx tsx scripts/diagnostic-routes-api.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface DiagnosticResult {
  route: string;
  status: "success" | "error" | "skipped";
  message: string;
  details?: any;
}

const results: DiagnosticResult[] = [];

async function testRoute(name: string, url: string, requiresAuth: boolean = true) {
  try {
    console.log(`\n🔍 Testing ${name}...`);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    const status = response.status;
    const data = await response.json().catch(() => ({}));

    if (status === 200 || status === 201) {
      results.push({
        route: name,
        status: "success",
        message: `✅ ${name} - Status: ${status}`,
        details: { status, dataKeys: Object.keys(data) },
      });
      console.log(`✅ ${name} - Status: ${status}`);
    } else if (status === 401 && !requiresAuth) {
      results.push({
        route: name,
        status: "skipped",
        message: `⏭️  ${name} - Auth required (expected)`,
      });
      console.log(`⏭️  ${name} - Auth required (expected)`);
    } else {
      results.push({
        route: name,
        status: "error",
        message: `❌ ${name} - Status: ${status}`,
        details: { status, error: data.error || data.message },
      });
      console.log(`❌ ${name} - Status: ${status}`, data);
    }
  } catch (error: unknown) {
    results.push({
      route: name,
      status: "error",
      message: `❌ ${name} - Exception: ${error.message}`,
      details: { error: error.message, stack: error.stack },
    });
    console.error(`❌ ${name} - Exception:`, error.message);
  }
}

async function testSupabaseConnection() {
  console.log("\n🔍 Testing Supabase Connection...");
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    results.push({
      route: "Supabase Config",
      status: "error",
      message: "❌ Missing Supabase environment variables",
      details: {
        hasUrl: !!SUPABASE_URL,
        hasAnonKey: !!SUPABASE_ANON_KEY,
      },
    });
    return;
  }

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Test de connexion basique
    const { data, error } = await client.from("profiles").select("count").limit(1);
    
    if (error) {
      results.push({
        route: "Supabase Connection",
        status: "error",
        message: `❌ Supabase connection error: ${error.message}`,
        details: { error: error.message, code: error.code },
      });
    } else {
      results.push({
        route: "Supabase Connection",
        status: "success",
        message: "✅ Supabase connection successful",
      });
    }
  } catch (error: unknown) {
    results.push({
      route: "Supabase Connection",
      status: "error",
      message: `❌ Supabase connection exception: ${error.message}`,
      details: { error: error.message },
    });
  }
}

async function testServiceRoleConnection() {
  console.log("\n🔍 Testing Service Role Connection...");
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    results.push({
      route: "Service Role Config",
      status: "error",
      message: "❌ Missing SUPABASE_SERVICE_ROLE_KEY",
    });
    return;
  }

  try {
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // Test de connexion avec service role
    const { data, error } = await client.from("profiles").select("count").limit(1);
    
    if (error) {
      results.push({
        route: "Service Role Connection",
        status: "error",
        message: `❌ Service role connection error: ${error.message}`,
        details: { error: error.message, code: error.code },
      });
    } else {
      results.push({
        route: "Service Role Connection",
        status: "success",
        message: "✅ Service role connection successful",
      });
    }
  } catch (error: unknown) {
    results.push({
      route: "Service Role Connection",
      status: "error",
      message: `❌ Service role connection exception: ${error.message}`,
      details: { error: error.message },
    });
  }
}

async function main() {
  console.log("🚀 Starting API Routes Diagnostic...\n");
  console.log("=" .repeat(60));

  // Test des connexions Supabase
  await testSupabaseConnection();
  await testServiceRoleConnection();

  // Test des routes API principales
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  console.log(`\n📡 Testing API routes on ${baseUrl}...`);

  // Routes critiques
  await testRoute("GET /api/properties", `${baseUrl}/api/properties`, true);
  await testRoute("GET /api/properties/test", `${baseUrl}/api/properties/test`, true);
  await testRoute("GET /api/owner/dashboard", `${baseUrl}/api/owner/dashboard`, true);
  await testRoute("GET /api/search", `${baseUrl}/api/search?q=test`, true);
  await testRoute("GET /api/charges", `${baseUrl}/api/charges`, true);
  await testRoute("GET /api/leases", `${baseUrl}/api/leases`, true);
  await testRoute("GET /api/debug/properties", `${baseUrl}/api/debug/properties`, true);

  // Afficher le résumé
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 DIAGNOSTIC SUMMARY\n");
  
  const successCount = results.filter(r => r.status === "success").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const skippedCount = results.filter(r => r.status === "skipped").length;

  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📊 Total: ${results.length}`);

  console.log("\n📋 DETAILED RESULTS:\n");
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
  });

  // Générer un rapport JSON
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    summary: {
      total: results.length,
      success: successCount,
      errors: errorCount,
      skipped: skippedCount,
    },
    results,
  };

  console.log("\n💾 Full report saved to: diagnostic-routes-report.json");
  require("fs").writeFileSync(
    "diagnostic-routes-report.json",
    JSON.stringify(report, null, 2)
  );

  // Exit avec code d'erreur si des erreurs critiques
  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch(console.error);


/**
 * Script de vérification de la connectivité Backend/Frontend
 * Vérifie que tous les endpoints API sont correctement utilisés par les services frontend
 */

import * as fs from "fs";
import * as path from "path";

interface EndpointInfo {
  method: string;
  path: string;
  file: string;
}

interface ServiceCall {
  method: string;
  path: string;
  file: string;
}

// Fonction pour extraire les endpoints API
function extractApiEndpoints(): EndpointInfo[] {
  const apiDir = path.join(process.cwd(), "app/api");
  const endpoints: EndpointInfo[] = [];

  function scanDirectory(dir: string, basePath: string = "") {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const newBasePath = basePath ? `${basePath}/${file}` : file;
        scanDirectory(fullPath, newBasePath);
      } else if (file === "route.ts") {
        const content = fs.readFileSync(fullPath, "utf-8");
        const methods = ["GET", "POST", "PATCH", "PUT", "DELETE"];

        for (const method of methods) {
          if (content.includes(`export async function ${method}`)) {
            // Convertir le chemin du fichier en chemin API
            let apiPath = basePath.replace(/\[(\w+)\]/g, ":$1");
            if (!apiPath.startsWith("/")) {
              apiPath = `/${apiPath}`;
            }

            endpoints.push({
              method,
              path: apiPath,
              file: fullPath.replace(process.cwd(), ""),
            });
          }
        }
      }
    }
  }

  scanDirectory(apiDir);
  return endpoints;
}

// Fonction pour extraire les appels API depuis les services
function extractServiceCalls(): ServiceCall[] {
  const servicesDir = path.join(process.cwd(), "features");
  const calls: ServiceCall[] = [];

  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.endsWith(".service.ts") || file.endsWith(".ts")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const apiClientRegex = /apiClient\.(get|post|patch|put|delete)\(["'`]([^"'`]+)["'`]/g;
        let match;

        while ((match = apiClientRegex.exec(content)) !== null) {
          calls.push({
            method: match[1].toUpperCase(),
            path: match[2],
            file: fullPath.replace(process.cwd(), ""),
          });
        }
      }
    }
  }

  scanDirectory(servicesDir);
  return calls;
}

// Fonction principale
function main() {
  console.log("🔍 Vérification de la connectivité Backend/Frontend...\n");

  const endpoints = extractApiEndpoints();
  const serviceCalls = extractServiceCalls();

  console.log(`📊 Statistiques:`);
  console.log(`   - Endpoints API trouvés: ${endpoints.length}`);
  console.log(`   - Appels service trouvés: ${serviceCalls.length}\n`);

  // Vérifier que chaque appel service a un endpoint correspondant
  const missingEndpoints: ServiceCall[] = [];
  const matchedEndpoints = new Set<string>();

  for (const call of serviceCalls) {
    const normalizedCallPath = call.path.replace(/\/:(\w+)/g, "/[$1]");
    const found = endpoints.some(
      (ep) =>
        ep.method === call.method &&
        (ep.path === call.path ||
          ep.path.replace(/\[(\w+)\]/g, ":$1") === call.path ||
          ep.path === normalizedCallPath)
    );

    if (!found) {
      missingEndpoints.push(call);
    } else {
      matchedEndpoints.add(`${call.method} ${call.path}`);
    }
  }

  // Rapport
  console.log("✅ Endpoints correctement connectés:");
  matchedEndpoints.forEach((ep) => console.log(`   - ${ep}`));

  if (missingEndpoints.length > 0) {
    console.log("\n⚠️  Appels service sans endpoint correspondant:");
    missingEndpoints.forEach((call) => {
      console.log(`   - ${call.method} ${call.path} (dans ${call.file})`);
    });
  }

  // Vérifier les endpoints non utilisés
  const unusedEndpoints = endpoints.filter(
    (ep) =>
      !serviceCalls.some(
        (call) =>
          call.method === ep.method &&
          (call.path === ep.path ||
            call.path === ep.path.replace(/\[(\w+)\]/g, ":$1") ||
            ep.path === call.path.replace(/\/:(\w+)/g, "/[$1]"))
      )
  );

  if (unusedEndpoints.length > 0) {
    console.log("\n📝 Endpoints API non utilisés (peut être normal):");
    unusedEndpoints.slice(0, 10).forEach((ep) => {
      console.log(`   - ${ep.method} ${ep.path} (dans ${ep.file})`);
    });
    if (unusedEndpoints.length > 10) {
      console.log(`   ... et ${unusedEndpoints.length - 10} autres`);
    }
  }

  console.log("\n✨ Vérification terminée!");
}

main();


/**
 * Service central de rendu HTML -> PDF via Puppeteer headless.
 *
 * Utilisation : reserve aux documents officiels (bail signe, EDL signe).
 * Les quittances continuent d'utiliser pdf-lib (generation simple, pas de HTML).
 *
 * Detection runtime :
 *   - local / dev       : utilise le Chrome systeme via PUPPETEER_EXECUTABLE_PATH
 *                         ou le binaire @sparticuz/chromium
 *   - Netlify (AWS Lambda) : utilise @sparticuz/chromium en mode serverless
 */

import type { Browser, PDFOptions } from "puppeteer-core";

export interface RenderPdfOptions {
  /** Format de page (par defaut A4) */
  format?: PDFOptions["format"];
  /** Inclure le background CSS dans le rendu (par defaut true) */
  printBackground?: boolean;
  /** Marges @page surchargeables */
  margin?: { top: string; right: string; bottom: string; left: string };
  /** Afficher un header/footer imprime (numero de page) */
  displayHeaderFooter?: boolean;
  /** Template HTML du header (HTML avec variables Puppeteer: pageNumber, totalPages) */
  headerTemplate?: string;
  /** Template HTML du footer */
  footerTemplate?: string;
  /** Timeout global (ms, defaut 30000) */
  timeout?: number;
}

const DEFAULT_MARGIN = {
  top: "25mm",
  right: "20mm",
  bottom: "25mm",
  left: "20mm",
};

const DEFAULT_FOOTER = `
  <div style="width:100%;font-family:Manrope,Arial,sans-serif;font-size:8pt;color:#6B7280;padding:0 20mm;display:flex;justify-content:space-between;">
    <span>Document genere par Talok</span>
    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>
`;

async function launchBrowser(): Promise<Browser> {
  const isNetlify = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const puppeteer = await import("puppeteer-core");

  if (isNetlify) {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default ?? chromiumModule;
    const executablePath = await chromium.executablePath();
    return puppeteer.default.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: chromium.defaultViewport,
    });
  }

  // Local / dev : essaie d'abord PUPPETEER_EXECUTABLE_PATH, sinon fallback sur chromium embarque.
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    return puppeteer.default.launch({
      executablePath: envPath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  // Fallback : utilise @sparticuz/chromium meme en local (plus lent mais fiable).
  const chromiumModule = await import("@sparticuz/chromium");
  const chromium = chromiumModule.default ?? chromiumModule;
  const executablePath = await chromium.executablePath();
  return puppeteer.default.launch({
    args: [...chromium.args, "--no-sandbox"],
    executablePath,
    headless: true,
  });
}

/**
 * Rend du HTML en PDF binaire.
 * Lance et ferme systematiquement un browser Chromium a chaque appel
 * pour eviter les fuites memoire en serverless.
 */
export async function renderHtmlToPdf(
  html: string,
  options: RenderPdfOptions = {}
): Promise<Buffer> {
  const timeoutMs = options.timeout ?? 30_000;

  const attemptRender = async (): Promise<Buffer> => {
    const browser = await launchBrowser();
    try {
      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: ["load", "networkidle0"],
        timeout: timeoutMs,
      });
      await page.emulateMediaType("print");

      const pdf = await page.pdf({
        format: options.format ?? "A4",
        printBackground: options.printBackground ?? true,
        margin: options.margin ?? DEFAULT_MARGIN,
        displayHeaderFooter: options.displayHeaderFooter ?? true,
        headerTemplate: options.headerTemplate ?? "<span></span>",
        footerTemplate: options.footerTemplate ?? DEFAULT_FOOTER,
        preferCSSPageSize: false,
        timeout: timeoutMs,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  };

  try {
    return await attemptRender();
  } catch (err) {
    // Retry 1x en cas de cold start raté (AWS Lambda / Netlify)
    console.warn("[html-to-pdf] Premier essai echoue, retry:", String(err));
    return attemptRender();
  }
}

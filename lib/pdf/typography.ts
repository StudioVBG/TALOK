/**
 * Injecteur typographique pour rendu PDF des documents officiels Talok.
 *
 * Au lieu de reecrire les 13 templates de bail et le template EDL,
 * on injecte en fin de <head> un bloc CSS qui surcharge la typographie :
 *   - Manrope embarque en @font-face (base64)
 *   - Justification + cesures actives sur tous les <p>
 *   - @page A4 avec marges propres
 *   - Orphans / widows controles
 *   - font-feature-settings : ligatures + kerning
 *   - Couleurs texte neutres (noir/gris, pas de bleu dans les paragraphes)
 *
 * Le fichier Manrope (woff2) est lu depuis public/fonts/ et integre en base64
 * pour que Puppeteer le recoive meme sans acces reseau.
 */

import fs from "node:fs";
import path from "node:path";

let MANROPE_BASE64_CACHE: string | null = null;

function getManropeBase64(): string {
  if (MANROPE_BASE64_CACHE) return MANROPE_BASE64_CACHE;
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "manrope-latin-wght-normal.woff2");
    const buf = fs.readFileSync(fontPath);
    MANROPE_BASE64_CACHE = buf.toString("base64");
    return MANROPE_BASE64_CACHE;
  } catch (err) {
    console.warn("[typography] Impossible de lire Manrope woff2, fallback sur sans-serif:", String(err));
    MANROPE_BASE64_CACHE = "";
    return "";
  }
}

function buildTypographyCss(): string {
  const manropeBase64 = getManropeBase64();
  const fontFace = manropeBase64
    ? `@font-face {
        font-family: 'Manrope';
        font-style: normal;
        font-weight: 200 800;
        font-display: swap;
        src: url(data:font/woff2;base64,${manropeBase64}) format('woff2');
      }`
    : "";

  return `
    ${fontFace}

    @page {
      size: A4;
      margin: 25mm 20mm 25mm 20mm;
    }

    /* Surcharge typographique globale - applique apres les styles du template */
    html, body {
      font-family: 'Manrope', 'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif !important;
      font-size: 10.5pt !important;
      line-height: 1.5 !important;
      color: #111827 !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      font-feature-settings: 'kern' 1, 'liga' 1, 'calt' 1;
      font-variant-numeric: lining-nums tabular-nums;
      background: #ffffff !important;
    }

    /* Justification + cesures sur tous les paragraphes */
    p, .article-content, .legal-notice {
      text-align: justify !important;
      text-justify: inter-word;
      hyphens: auto;
      -webkit-hyphens: auto;
      -ms-hyphens: auto;
      orphans: 3;
      widows: 3;
      hyphenate-limit-chars: 6 2 2;
    }

    /* Titres : a gauche, jamais orphelins */
    h1, h2, h3, h4, h5, h6,
    .header h1, .section-title, .article-title, .party-title {
      text-align: left !important;
      hyphens: manual;
      break-after: avoid;
      page-break-after: avoid;
      font-family: 'Manrope', sans-serif !important;
      font-weight: 700;
      color: #111827 !important;
    }

    /* Blocs qui ne doivent pas se couper */
    .section, .article, .party-box, .signature-box,
    .financial-summary, .diagnostic-card, table {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Listes : pas justifiees */
    ul, ol, li {
      text-align: left !important;
      hyphens: manual;
    }

    /* Tableaux : alignement propre */
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      text-align: left;
      hyphens: manual;
    }

    /* Cachet "DOCUMENT SIGNE ET CERTIFIE" - pur CSS, pas de JS */
    .sealed-badge,
    .talok-seal {
      position: fixed;
      top: 8mm;
      right: 8mm;
      background: #059669;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
      z-index: 9999;
    }

    /* Page de garde / sections imprimees : fond blanc propre */
    .page {
      background: #ffffff !important;
      padding: 0 !important;
    }

    /* Reset couleurs bleues vives des templates - on garde du noir pour le contenu officiel */
    .header h1 {
      color: #0F172A !important;
    }
    .section-title {
      background: #0F172A !important;
      color: #ffffff !important;
    }

    /* Images de signature : contrast correct a l'impression */
    .signature-image {
      max-width: 180px;
      max-height: 70px;
      object-fit: contain;
      filter: contrast(1.05);
    }

    /* Footer / numerotation gerees par Puppeteer headerTemplate/footerTemplate */
    .footer {
      font-size: 8.5pt;
      color: #6B7280;
    }
  `;
}

/**
 * Injecte les overrides typographiques dans un HTML existant.
 * Respecte la structure du template (inject apres le dernier <style> ou avant </head>).
 */
export function injectTypography(html: string): string {
  const css = buildTypographyCss();
  const styleBlock = `<style data-talok-typography="1">${css}</style>`;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleBlock}</head>`);
  }
  // Fallback : prefixe le HTML
  return `${styleBlock}${html}`;
}

/**
 * Template HTML de footer pour Puppeteer (numero de page + reference document).
 */
export function buildPdfFooter(reference: string, subtitle?: string): string {
  return `
    <div style="width:100%;font-family:Manrope,Arial,sans-serif;font-size:8pt;color:#6B7280;padding:0 20mm;display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(reference)}${subtitle ? ` &mdash; ${escapeHtml(subtitle)}` : ""}</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

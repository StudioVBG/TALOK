/**
 * Branded QR code generator — Talok 2026
 *
 * Génère un QR code PNG avec le logo Talok au centre.
 * Utilise `qrcode` pour la génération du QR et `sharp` (déjà installé)
 * pour composer le logo par-dessus.
 *
 * Renvoie un data URL base64 directement consommable par <img src=...>.
 *
 * NOTE : ce module est server-only (Node runtime). Les routes qui l'importent
 * doivent déclarer `export const runtime = "nodejs"`.
 */

import QRCode from "qrcode";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

export interface BrandedQROptions {
  /** Taille en pixels (carré). Défaut 320. */
  size?: number;
  /** Inclure le logo Talok au centre. Défaut true. */
  withLogo?: boolean;
  /**
   * Niveau de correction d'erreur. Défaut "H" (30%).
   * Obligatoire en H si withLogo=true pour rester scannable.
   */
  errorCorrection?: "L" | "M" | "Q" | "H";
  /** Couleur des modules sombres. Défaut #0F172A (slate-900). */
  darkColor?: string;
  /** Couleur de fond. Défaut #FFFFFF. */
  lightColor?: string;
  /** Marge en modules. Défaut 1. */
  margin?: number;
}

const DEFAULT_OPTIONS: Required<BrandedQROptions> = {
  size: 320,
  withLogo: true,
  errorCorrection: "H",
  darkColor: "#0F172A",
  lightColor: "#FFFFFF",
  margin: 1,
};

const LOGO_PATH = path.join(process.cwd(), "public/images/talok-icon.png");
let cachedLogoBuffer: Buffer | null = null;
let logoLoadFailed = false;

async function getLogoBuffer(): Promise<Buffer | null> {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  if (logoLoadFailed) return null;
  try {
    cachedLogoBuffer = await fs.readFile(LOGO_PATH);
    return cachedLogoBuffer;
  } catch (err) {
    // Vercel serverless ne bundle pas public/ par défaut. On log une fois et
    // on retombe sur un QR sans logo plutôt que de bloquer le flow 2FA.
    logoLoadFailed = true;
    console.warn(
      "[qr/generator] Logo Talok introuvable, fallback QR sans logo:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Génère un QR code brandé (avec logo Talok) sous forme de data URL PNG.
 *
 * @example
 * const dataUrl = await generateBrandedQR("https://talok.fr/qr/scan/abc");
 * // <img src={dataUrl} />
 */
export async function generateBrandedQR(
  data: string,
  options: BrandedQROptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Forcer EC=H si logo demandé (sinon le QR devient illisible)
  const ecLevel = opts.withLogo ? "H" : opts.errorCorrection;

  const qrBuffer = await QRCode.toBuffer(data, {
    type: "png",
    width: opts.size,
    margin: opts.margin,
    errorCorrectionLevel: ecLevel,
    color: {
      dark: opts.darkColor,
      light: opts.lightColor,
    },
  });

  if (!opts.withLogo) {
    return `data:image/png;base64,${qrBuffer.toString("base64")}`;
  }

  const logoSrc = await getLogoBuffer();
  if (!logoSrc) {
    // Logo introuvable (Vercel serverless ne bundle pas public/) → QR plain
    return `data:image/png;base64,${qrBuffer.toString("base64")}`;
  }

  // Logo : 22% du QR, fond blanc arrondi pour isoler des modules
  const logoSize = Math.round(opts.size * 0.22);
  const padding = Math.round(opts.size * 0.018);
  const backgroundSize = logoSize + padding * 2;
  const radius = Math.round(backgroundSize * 0.18);
  const logoResized = await sharp(logoSrc)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const whiteBackground = await sharp({
    create: {
      width: backgroundSize,
      height: backgroundSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${backgroundSize}" height="${backgroundSize}">
            <rect width="${backgroundSize}" height="${backgroundSize}" rx="${radius}" ry="${radius}" fill="white"/>
          </svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const center = Math.round((opts.size - backgroundSize) / 2);
  const logoCenter = Math.round((opts.size - logoSize) / 2);

  const finalBuffer = await sharp(qrBuffer)
    .composite([
      { input: whiteBackground, left: center, top: center },
      { input: logoResized, left: logoCenter, top: logoCenter },
    ])
    .png()
    .toBuffer();

  return `data:image/png;base64,${finalBuffer.toString("base64")}`;
}

/**
 * Variante : renvoie directement le Buffer (utile pour réponses HTTP image/png).
 */
export async function generateBrandedQRBuffer(
  data: string,
  options: BrandedQROptions = {}
): Promise<Buffer> {
  const dataUrl = await generateBrandedQR(data, options);
  const base64 = dataUrl.split(",")[1];
  return Buffer.from(base64, "base64");
}

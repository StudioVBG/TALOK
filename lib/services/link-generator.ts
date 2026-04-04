/**
 * Service centralisé de génération de liens Talok
 *
 * Gère le switching conditionnel entre :
 * - Universal Links (https://) pour emails/SMS → interceptés par l'app si installée
 * - Deep links (talok://) pour QR codes → ouvrent l'app directement
 * - Liens relatifs pour la navigation in-app
 *
 * @see https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app
 * @see https://developer.android.com/training/app-links
 */

const APP_SCHEME = "talok://";
const WEB_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://talok.fr";

type LinkContext = "email" | "sms" | "push" | "qr" | "in-app";

interface PushLinkPayload {
  web: string;
  app: string;
}

/**
 * Génère un lien adapté au contexte de distribution.
 *
 * - email/sms : Universal Link (https://) — clients mail ne supportent pas les custom schemes.
 *   L'app mobile intercepte automatiquement via apple-app-site-association / assetlinks.json.
 * - qr : Deep link direct (talok://) — le scan ouvre l'app si installée.
 * - push : Les deux formats — le handler push client choisit.
 * - in-app : Lien relatif (navigation Next.js).
 */
export function generateLink(
  path: string,
  context: LinkContext
): string | PushLinkPayload {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  switch (context) {
    case "email":
    case "sms":
      return `${WEB_BASE}${cleanPath}`;

    case "qr":
      // Deep link direct — fallback web géré côté client si l'app n'est pas installée
      return `${APP_SCHEME}${cleanPath.slice(1)}`;

    case "push":
      return {
        web: `${WEB_BASE}${cleanPath}`,
        app: `${APP_SCHEME}${cleanPath.slice(1)}`,
      };

    case "in-app":
      return cleanPath;

    default:
      return `${WEB_BASE}${cleanPath}`;
  }
}

/**
 * Shortcut pour les liens email (cas le plus courant côté serveur).
 */
export function emailLink(path: string): string {
  return generateLink(path, "email") as string;
}

/**
 * Shortcut pour les liens QR code.
 */
export function qrLink(path: string): string {
  return generateLink(path, "qr") as string;
}

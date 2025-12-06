/**
 * Déclaration de type pour puppeteer (optionnel)
 * Permet au build de fonctionner même si puppeteer n'est pas installé
 */

declare module 'puppeteer' {
  interface LaunchOptions {
    headless?: boolean | 'new';
    args?: string[];
  }

  interface PDFOptions {
    format?: 'A4' | 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A5' | 'A6';
    landscape?: boolean;
    margin?: {
      top?: string | number;
      right?: string | number;
      bottom?: string | number;
      left?: string | number;
    };
    printBackground?: boolean;
  }

  interface Page {
    setContent(html: string, options?: { waitUntil?: string | string[] }): Promise<void>;
    pdf(options?: PDFOptions): Promise<Buffer>;
  }

  interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  function launch(options?: LaunchOptions): Promise<Browser>;

  export default {
    launch
  };
}


/**
 * Complete type definitions for html2pdf.js
 * Replaces the library's shipped type.d.ts which is missing the pagebreak option.
 * Mapped via tsconfig paths: "html2pdf.js" -> "./types/html2pdf"
 */
declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | [number, number] | [number, number, number, number];
    filename?: string;
    image?: {
      type?: "jpeg" | "png" | "webp";
      quality?: number;
    };
    enableLinks?: boolean;
    html2canvas?: Record<string, unknown>;
    jsPDF?: {
      unit?: string;
      format?: string | [number, number];
      orientation?: "portrait" | "landscape";
    };
    pagebreak?: {
      mode?: Array<"avoid-all" | "css" | "legacy" | "always"> | "css" | "legacy" | "avoid-all";
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }

  interface Html2PdfWorker {
    from(src: HTMLElement | string | HTMLCanvasElement | HTMLImageElement): this;
    to(target: "container" | "canvas" | "img" | "pdf"): this;
    toContainer(): this;
    toCanvas(): this;
    toImg(): this;
    toPdf(): this;
    output(type?: string, options?: unknown, src?: "pdf" | "img"): Promise<unknown>;
    outputPdf(type?: string, options?: unknown): Promise<unknown>;
    outputImg(type?: string, options?: unknown): Promise<unknown>;
    save(filename?: string): Promise<void>;
    set(options: Html2PdfOptions): this;
    get(key: string, cbk?: (value: unknown) => void): Promise<unknown>;
    then<T>(onFulfilled?: (value: unknown) => T | PromiseLike<T>, onRejected?: (reason: unknown) => unknown): Promise<T>;
    catch<T>(onRejected?: (reason: unknown) => T | PromiseLike<T>): Promise<T>;
    error(msg: string): void;
  }

  interface Html2PdfStatic {
    (): Html2PdfWorker;
    new (): Html2PdfWorker;
    (element: HTMLElement, options?: Html2PdfOptions): Promise<void>;
    new (element: HTMLElement, options?: Html2PdfOptions): Promise<void>;
    Worker: new () => Html2PdfWorker;
  }

  const html2pdf: Html2PdfStatic;
  export default html2pdf;
}

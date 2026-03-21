declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    pagebreak?: {
      mode?: Array<'avoid-all' | 'css' | 'legacy' | string>;
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }
}

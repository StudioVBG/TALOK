/**
 * Tests unitaires - Validation de fichiers (MIME, extension, taille)
 * 
 * Couvre les correctifs P0 de l'audit BIC2026:
 * - Whitelist MIME types
 * - Blocage des extensions dangereuses (.html, .exe, .js, etc.)
 * - Validation de taille
 * - Fichiers vides rejetés
 */

import { describe, it, expect } from "vitest";
import {
  validateFile,
  validateFiles,
  ALL_ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZES,
} from "@/lib/security/file-validation";

// Helper pour créer un faux objet File
function createMockFile(
  name: string,
  size: number,
  type: string
): File {
  const content = new Uint8Array(size);
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

describe("File Validation", () => {
  describe("validateFile - MIME types", () => {
    it("accepte un PDF", () => {
      const file = createMockFile("document.pdf", 1024, "application/pdf");
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepte une image JPEG", () => {
      const file = createMockFile("photo.jpg", 1024, "image/jpeg");
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepte une image PNG", () => {
      const file = createMockFile("capture.png", 1024, "image/png");
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepte une image WebP", () => {
      const file = createMockFile("photo.webp", 1024, "image/webp");
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepte un fichier Word docx", () => {
      const file = createMockFile(
        "bail.docx",
        1024,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepte un CSV", () => {
      const file = createMockFile("data.csv", 1024, "text/csv");
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("rejette un fichier HTML (XSS stored)", () => {
      const file = createMockFile("malicious.html", 1024, "text/html");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un fichier JavaScript", () => {
      const file = createMockFile("exploit.js", 1024, "application/javascript");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un fichier exécutable", () => {
      const file = createMockFile("virus.exe", 1024, "application/x-msdownload");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un fichier SVG (XSS potentiel)", () => {
      const file = createMockFile("icon.svg", 1024, "image/svg+xml");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un fichier PHP", () => {
      const file = createMockFile("shell.php", 1024, "application/x-php");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un fichier Python", () => {
      const file = createMockFile("script.py", 1024, "text/x-python");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un fichier shell", () => {
      const file = createMockFile("hack.sh", 1024, "application/x-sh");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette un type MIME inconnu", () => {
      const file = createMockFile("data.xyz", 1024, "application/octet-stream");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateFile - Taille", () => {
    it("accepte un fichier sous la limite (10 MB)", () => {
      const file = createMockFile("doc.pdf", 5 * 1024 * 1024, "application/pdf");
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it("rejette un fichier vide", () => {
      const file = createMockFile("empty.pdf", 0, "application/pdf");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("EMPTY_FILE");
    });

    it("rejette un fichier trop gros (> 10 MB par défaut)", () => {
      const file = createMockFile("huge.pdf", 11 * 1024 * 1024, "application/pdf");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("FILE_TOO_LARGE");
    });

    it("respecte une limite personnalisée (signature = 500 KB)", () => {
      const file = createMockFile("sig.png", 600 * 1024, "image/png");
      const result = validateFile(file, { maxSize: MAX_FILE_SIZES.signature });
      expect(result.valid).toBe(false);
      expect(result.code).toBe("FILE_TOO_LARGE");
    });

    it("accepte un fichier dans la limite personnalisée", () => {
      const file = createMockFile("sig.png", 400 * 1024, "image/png");
      const result = validateFile(file, { maxSize: MAX_FILE_SIZES.signature });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateFile - Extensions", () => {
    it("rejette un fichier sans extension (nom finissant par '.')", () => {
      const file = createMockFile("document.", 1024, "application/pdf");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("NO_EXTENSION");
    });

    it("accepte un fichier sans extension si option activée", () => {
      const file = createMockFile("document.", 1024, "application/pdf");
      const result = validateFile(file, { allowNoExtension: true });
      expect(result.valid).toBe(true);
    });

    it("rejette un fichier dont le 'nom' est une extension non-autorisée", () => {
      // 'noextension'.split('.').pop() = 'noextension' → traité comme extension
      const file = createMockFile("noextension", 1024, "application/pdf");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette .bat (batch Windows)", () => {
      const file = createMockFile("install.bat", 1024, "application/x-bat");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette .vbs (VBScript)", () => {
      const file = createMockFile("script.vbs", 1024, "text/vbscript");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });

    it("rejette .dll", () => {
      const file = createMockFile("lib.dll", 1024, "application/x-msdownload");
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("BLOCKED_EXTENSION");
    });
  });

  describe("validateFile - MIME type restriction personnalisée", () => {
    it("accepte uniquement les images quand configuré", () => {
      const imageOnly = ["image/jpeg", "image/png", "image/webp"];
      
      const pdf = createMockFile("doc.pdf", 1024, "application/pdf");
      expect(validateFile(pdf, { allowedMimeTypes: imageOnly }).valid).toBe(false);

      const jpg = createMockFile("photo.jpg", 1024, "image/jpeg");
      expect(validateFile(jpg, { allowedMimeTypes: imageOnly }).valid).toBe(true);
    });
  });

  describe("validateFiles - Batch validation", () => {
    it("accepte un lot de fichiers valides", () => {
      const files = [
        createMockFile("doc1.pdf", 1024, "application/pdf"),
        createMockFile("photo.jpg", 2048, "image/jpeg"),
        createMockFile("data.csv", 512, "text/csv"),
      ];
      const result = validateFiles(files);
      expect(result.valid).toBe(true);
    });

    it("rejette le lot si un seul fichier est invalide", () => {
      const files = [
        createMockFile("doc1.pdf", 1024, "application/pdf"),
        createMockFile("hack.html", 512, "text/html"),
        createMockFile("photo.jpg", 2048, "image/jpeg"),
      ];
      const result = validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("hack.html");
    });

    it("rejette si un fichier dépasse la taille", () => {
      const files = [
        createMockFile("small.pdf", 1024, "application/pdf"),
        createMockFile("big.pdf", 15 * 1024 * 1024, "application/pdf"),
      ];
      const result = validateFiles(files);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("big.pdf");
      expect(result.code).toBe("FILE_TOO_LARGE");
    });
  });

  describe("Constants", () => {
    it("ALL_ALLOWED_MIME_TYPES contient au moins les types essentiels", () => {
      expect(ALL_ALLOWED_MIME_TYPES).toContain("application/pdf");
      expect(ALL_ALLOWED_MIME_TYPES).toContain("image/jpeg");
      expect(ALL_ALLOWED_MIME_TYPES).toContain("image/png");
      expect(ALL_ALLOWED_MIME_TYPES).toContain("image/webp");
    });

    it("ALL_ALLOWED_MIME_TYPES ne contient PAS de types dangereux", () => {
      expect(ALL_ALLOWED_MIME_TYPES).not.toContain("text/html");
      expect(ALL_ALLOWED_MIME_TYPES).not.toContain("application/javascript");
      expect(ALL_ALLOWED_MIME_TYPES).not.toContain("image/svg+xml");
    });

    it("ALLOWED_EXTENSIONS contient les extensions attendues", () => {
      expect(ALLOWED_EXTENSIONS.has("pdf")).toBe(true);
      expect(ALLOWED_EXTENSIONS.has("jpg")).toBe(true);
      expect(ALLOWED_EXTENSIONS.has("png")).toBe(true);
      expect(ALLOWED_EXTENSIONS.has("csv")).toBe(true);
    });

    it("ALLOWED_EXTENSIONS ne contient PAS les extensions dangereuses", () => {
      expect(ALLOWED_EXTENSIONS.has("html")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has("js")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has("exe")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has("php")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has("svg")).toBe(false);
    });
  });
});

import { describe, it, expect } from "vitest";
import { cleanAttachmentName, truncateMiddle } from "@/lib/utils/clean-filename";

describe("cleanAttachmentName", () => {
  it("removes user ID prefix, embedded UUID, trailing _N suffix and converts underscores to spaces", () => {
    const input =
      "u4725513253_Appartement_T3_-_chambre_principale_realistic_mas_943f417c-e62d-4224-aa56-836a1563f969_1.png";
    expect(cleanAttachmentName(input)).toBe(
      "Appartement T3 - chambre principale realistic mas.png"
    );
  });

  it("keeps a simple filename untouched (apart from underscore replacement)", () => {
    expect(cleanAttachmentName("document.pdf")).toBe("document.pdf");
    expect(cleanAttachmentName("my_file.pdf")).toBe("my file.pdf");
  });

  it("handles a filename without extension", () => {
    expect(cleanAttachmentName("u123_my_document")).toBe("my document");
  });

  it("cleans multiple UUID-like segments", () => {
    const input =
      "u42_report_12345678-1234-1234-1234-123456789abc_final.docx";
    expect(cleanAttachmentName(input)).toBe("report final.docx");
  });
});

describe("truncateMiddle", () => {
  it("leaves short names unchanged", () => {
    expect(truncateMiddle("short.png")).toBe("short.png");
  });

  it("truncates long names preserving extension and showing an ellipsis", () => {
    const long =
      "a-very-long-file-name-that-is-well-above-the-limit-really.png";
    const out = truncateMiddle(long, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith(".png")).toBe(true);
    expect(out).toContain("…");
  });
});

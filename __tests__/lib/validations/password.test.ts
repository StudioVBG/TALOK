import { describe, it, expect } from "vitest";
import { passwordSchema, validatePassword } from "@/lib/validations/onboarding";

describe("passwordSchema", () => {
  it("rejects passwords shorter than 12 characters", () => {
    const result = passwordSchema.safeParse("Abcdef1!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without uppercase", () => {
    const result = passwordSchema.safeParse("abcdefghij1!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without lowercase", () => {
    const result = passwordSchema.safeParse("ABCDEFGHIJ1!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without digit", () => {
    const result = passwordSchema.safeParse("Abcdefghijk!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without special character", () => {
    const result = passwordSchema.safeParse("Abcdefghij12");
    expect(result.success).toBe(false);
  });

  it("accepts a valid password with all requirements", () => {
    const result = passwordSchema.safeParse("Abcdefghij1!");
    expect(result.success).toBe(true);
  });

  it("accepts a strong password", () => {
    const result = passwordSchema.safeParse("MyStr0ng!Pass#2026");
    expect(result.success).toBe(true);
  });

  it("rejects empty string", () => {
    const result = passwordSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("validatePassword", () => {
  it("returns valid: true for a valid password", () => {
    const result = validatePassword("Abcdefghij1!");
    expect(result).toEqual({ valid: true });
  });

  it("returns valid: false with French error message for short password", () => {
    const result = validatePassword("Ab1!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("12 caractères");
  });

  it("returns valid: false with French error message for missing uppercase", () => {
    const result = validatePassword("abcdefghij1!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("majuscule");
  });

  it("returns valid: false with French error message for missing lowercase", () => {
    const result = validatePassword("ABCDEFGHIJ1!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("minuscule");
  });

  it("returns valid: false with French error message for missing digit", () => {
    const result = validatePassword("Abcdefghijk!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("chiffre");
  });

  it("returns valid: false with French error message for missing special char", () => {
    const result = validatePassword("Abcdefghij12");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("spécial");
  });
});

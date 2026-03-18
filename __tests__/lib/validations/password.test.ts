import { describe, it, expect } from "vitest";
import { passwordSchema } from "@/lib/validations/onboarding";

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

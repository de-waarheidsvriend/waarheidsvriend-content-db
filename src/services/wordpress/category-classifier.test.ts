/**
 * Category Classifier Tests
 */

import { describe, it, expect } from "vitest";
import {
  PREDEFINED_CATEGORIES,
  validateCategory,
} from "./category-classifier";

describe("PREDEFINED_CATEGORIES", () => {
  it("should have 55 categories", () => {
    expect(PREDEFINED_CATEGORIES.length).toBe(55);
  });

  it("should include expected categories", () => {
    expect(PREDEFINED_CATEGORIES).toContain("Actualiteit");
    expect(PREDEFINED_CATEGORIES).toContain("Kerk");
    expect(PREDEFINED_CATEGORIES).toContain("Zending");
    expect(PREDEFINED_CATEGORIES).toContain("Memoriam");
  });
});

describe("validateCategory", () => {
  it("should return the category for exact matches", () => {
    expect(validateCategory("Actualiteit")).toBe("Actualiteit");
    expect(validateCategory("Kerk")).toBe("Kerk");
  });

  it("should return the category for case-insensitive matches", () => {
    expect(validateCategory("actualiteit")).toBe("Actualiteit");
    expect(validateCategory("KERK")).toBe("Kerk");
    expect(validateCategory("ZeNdInG")).toBe("Zending");
  });

  it("should return null for invalid categories", () => {
    expect(validateCategory("Invalid")).toBeNull();
    expect(validateCategory("Foo")).toBeNull();
    expect(validateCategory("")).toBeNull();
  });

  it("should handle whitespace", () => {
    expect(validateCategory("  Actualiteit  ")).toBe("Actualiteit");
  });
});

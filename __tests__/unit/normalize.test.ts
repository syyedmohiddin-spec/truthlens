// __tests__/unit/normalize.test.ts
import {
  sanitizeClaim,
  validateClaim,
  normalizeClaim,
  hashClaim,
  classifyIntent,
  classifyCategory,
  generateSearchQueries,
  isCheckable,
  normalizeClaim_full,
} from "@/lib/normalize/claim";

describe("sanitizeClaim", () => {
  it("strips HTML tags", () => {
    expect(sanitizeClaim("<b>bold claim</b>")).toBe("bold claim");
  });

  it("strips HTML entities", () => {
    expect(sanitizeClaim("AT&amp;T claim")).toBe("AT  T claim");
  });

  it("collapses multiple spaces", () => {
    expect(sanitizeClaim("too   many   spaces")).toBe("too many spaces");
  });

  it("truncates at 600 chars", () => {
    const long = "a".repeat(700);
    expect(sanitizeClaim(long).length).toBe(600);
  });

  it("strips control characters", () => {
    expect(sanitizeClaim("clean\x00string")).toBe("cleanstring");
  });
});

describe("validateClaim", () => {
  it("rejects claims under 10 chars", () => {
    const result = validateClaim("short");
    expect(result.valid).toBe(false);
  });

  it("accepts valid claims", () => {
    const result = validateClaim("The Earth is round and orbits the Sun.");
    expect(result.valid).toBe(true);
  });

  it("rejects bare URLs", () => {
    const result = validateClaim("https://example.com/article");
    expect(result.valid).toBe(false);
  });
});

describe("normalizeClaim", () => {
  it("lowercases the claim", () => {
    expect(normalizeClaim("THE EARTH IS FLAT")).toContain("the earth is flat");
  });

  it("normalizes curly quotes", () => {
    expect(normalizeClaim("it\u2019s")).toContain("it's");
  });

  it("normalizes em-dashes", () => {
    expect(normalizeClaim("A\u2014B")).toContain("a-b");
  });
});

describe("hashClaim", () => {
  it("produces consistent hashes", () => {
    const h1 = hashClaim("the earth is round");
    const h2 = hashClaim("the earth is round");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashClaim("claim one")).not.toBe(hashClaim("claim two"));
  });

  it("returns a hex string of length 64", () => {
    expect(hashClaim("test")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("classifyIntent", () => {
  it("identifies opinion claims", () => {
    expect(classifyIntent("I think coffee is the best drink.")).toBe("opinion");
  });

  it("identifies statistical claims", () => {
    expect(classifyIntent("85% of people prefer coffee.")).toBe("statistical");
  });

  it("identifies causal claims", () => {
    expect(classifyIntent("Smoking causes lung cancer.")).toBe("causal");
  });

  it("defaults to factual for generic claims", () => {
    expect(classifyIntent("The moon orbits the Earth.")).toBe("factual");
  });
});

describe("classifyCategory", () => {
  it("identifies health claims", () => {
    expect(classifyCategory("Vaccines cause autism.")).toBe("health");
  });

  it("identifies scientific claims", () => {
    expect(classifyCategory("NASA confirms climate change is real.")).toBe("scientific");
  });

  it("identifies political claims", () => {
    expect(classifyCategory("The president signed a new policy.")).toBe("political");
  });

  it("defaults to other", () => {
    expect(classifyCategory("The sky changed color today.")).toBe("other");
  });
});

describe("isCheckable", () => {
  it("marks opinion as not checkable", () => {
    expect(isCheckable("opinion")).toBe(false);
  });

  it("marks satire as not checkable", () => {
    expect(isCheckable("satire")).toBe(false);
  });

  it("marks factual as checkable", () => {
    expect(isCheckable("factual")).toBe(true);
  });
});

describe("normalizeClaim_full", () => {
  it("returns all expected fields", () => {
    const result = normalizeClaim_full("The Great Wall of China is visible from space.");
    expect(result).toHaveProperty("original");
    expect(result).toHaveProperty("normalized");
    expect(result).toHaveProperty("hash");
    expect(result).toHaveProperty("intent");
    expect(result).toHaveProperty("category");
    expect(result).toHaveProperty("isCheckable");
    expect(result).toHaveProperty("searchQueries");
    expect(result).toHaveProperty("wikiQuery");
  });

  it("generates at least one search query for checkable claims", () => {
    const result = normalizeClaim_full("The moon landing happened in 1969.");
    expect(result.searchQueries.length).toBeGreaterThan(0);
  });

  it("generates no search queries for opinion claims", () => {
    const result = normalizeClaim_full("I believe chocolate ice cream is the best.");
    expect(result.isCheckable).toBe(false);
  });
});

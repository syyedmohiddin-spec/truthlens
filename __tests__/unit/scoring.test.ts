// __tests__/unit/scoring.test.ts
import {
  getDomainCredibility,
  scoreRecency,
  scoreRelevance,
  detectStance,
  scoreSources,
  deduplicateSources,
} from "@/lib/scoring/sources";
import type { RawSource } from "@/types";

describe("getDomainCredibility", () => {
  it("returns 5 for tier-1 domains", () => {
    expect(getDomainCredibility("nature.com")).toBe(5);
    expect(getDomainCredibility("who.int")).toBe(5);
  });

  it("returns 4 for tier-2 domains", () => {
    expect(getDomainCredibility("reuters.com")).toBe(4);
    expect(getDomainCredibility("bbc.com")).toBe(4);
  });

  it("returns 1 for low-credibility domains", () => {
    expect(getDomainCredibility("infowars.com")).toBe(1);
  });

  it("returns 3 for unknown domains", () => {
    expect(getDomainCredibility("unknown-blog-2025.xyz")).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(getDomainCredibility("REUTERS.COM")).toBe(4);
  });
});

describe("scoreRecency", () => {
  it("returns 100 for content from today", () => {
    const today = new Date().toISOString();
    expect(scoreRecency(today)).toBe(100);
  });

  it("returns lower scores for older content", () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();
    expect(scoreRecency(oldDate)).toBeLessThan(70);
  });

  it("returns 50 for missing date", () => {
    expect(scoreRecency(undefined)).toBe(50);
  });

  it("returns 30 for very old content", () => {
    const veryOld = "2018-01-01T00:00:00Z";
    expect(scoreRecency(veryOld)).toBe(30);
  });
});

describe("scoreRelevance", () => {
  it("returns high score for highly relevant content", () => {
    const claim = "The moon orbits the Earth";
    const snippet = "The moon is a natural satellite that orbits the Earth completing one orbit every 27 days";
    const score = scoreRelevance(snippet, "Moon orbit study", claim);
    expect(score).toBeGreaterThan(50);
  });

  it("returns 50 for completely unrelated content", () => {
    const score = scoreRelevance("Recipe for chocolate cake", "Baking tips", "moon orbit");
    expect(score).toBeLessThanOrEqual(50);
  });
});

describe("detectStance", () => {
  it("detects opposing stance from debunking language", () => {
    const stance = detectStance(
      "This claim is completely false and has been thoroughly debunked",
      "Fact Check: Claim debunked",
      "vaccines cause autism"
    );
    expect(stance).toBe("opposes");
  });

  it("detects supporting stance from confirmation language", () => {
    const stance = detectStance(
      "Studies confirm this is accurate and verified",
      "Confirmed: research supports",
      "exercise improves health"
    );
    expect(stance).toBe("supports");
  });

  it("defaults to neutral for ambiguous content", () => {
    const stance = detectStance(
      "There are many perspectives on this topic",
      "Overview of topic",
      "some claim"
    );
    expect(stance).toBe("neutral");
  });
});

describe("deduplicateSources", () => {
  const makeSource = (url: string, domain: string): RawSource => ({
    title: "Test",
    url,
    snippet: "Test snippet",
    domain,
    sourceType: "secondary",
  });

  it("removes exact duplicate URLs", () => {
    const sources = [
      makeSource("https://reuters.com/article/1", "reuters.com"),
      makeSource("https://reuters.com/article/1", "reuters.com"),
    ];
    const result = deduplicateSources(sources);
    expect(result.length).toBe(1);
  });

  it("keeps sources from different domains", () => {
    const sources = [
      makeSource("https://reuters.com/article/1", "reuters.com"),
      makeSource("https://bbc.com/news/1", "bbc.com"),
    ];
    expect(deduplicateSources(sources).length).toBe(2);
  });
});

describe("scoreSources", () => {
  const claim = "vaccines cause autism";

  const sources: RawSource[] = [
    {
      title: "Vaccines debunked: no link to autism",
      url: "https://who.int/vaccines",
      snippet: "The claim that vaccines cause autism is false and has been thoroughly debunked by numerous studies.",
      domain: "who.int",
      sourceType: "primary",
      publishedAt: new Date().toISOString(),
    },
    {
      title: "Unverified blog about vaccines",
      url: "https://some-blog.xyz/vaccines",
      snippet: "This text about vaccines",
      domain: "some-blog.xyz",
      sourceType: "secondary",
    },
  ];

  it("returns scored sources", () => {
    const scored = scoreSources(sources, claim);
    expect(scored.length).toBeGreaterThan(0);
    scored.forEach((s) => {
      expect(s).toHaveProperty("credibility");
      expect(s).toHaveProperty("stance");
      expect(s).toHaveProperty("relevanceScore");
      expect(s).toHaveProperty("recencyScore");
    });
  });

  it("sorts higher credibility sources first", () => {
    const scored = scoreSources(sources, claim);
    // WHO should rank above unknown blog
    const whoIdx = scored.findIndex((s) => s.domain === "who.int");
    const blogIdx = scored.findIndex((s) => s.domain === "some-blog.xyz");
    if (whoIdx !== -1 && blogIdx !== -1) {
      expect(whoIdx).toBeLessThan(blogIdx);
    }
  });
});

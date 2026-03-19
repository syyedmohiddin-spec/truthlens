// src/types/index.ts
// Central type contract for TruthLens.
// All layers must conform to these interfaces.

// ── VERDICT ────────────────────────────────────────────────────────────────────
export type Verdict = "TRUE" | "FALSE" | "MIXED" | "UNVERIFIED";

export type ClaimCategory =
  | "scientific"
  | "political"
  | "historical"
  | "health"
  | "financial"
  | "geographical"
  | "cultural"
  | "legal"
  | "opinion"
  | "satire"
  | "rumor"
  | "mixed"
  | "other";

export type ClaimIntent =
  | "factual"    // Claims something objectively happened or is true
  | "statistical" // Contains numeric claims
  | "causal"     // Claims X causes Y
  | "predictive" // Claims something will happen
  | "definitional" // Claims X means Y
  | "opinion"    // Personal view, not checkable
  | "satire"     // Clearly humorous/satirical
  | "unknown";

export type SourceStance = "supports" | "opposes" | "neutral";
export type SourceType = "primary" | "secondary" | "fact-check" | "encyclopedia" | "news";
export type SynthesisMode = "rules" | "cached" | "claude" | "gemini" | "openrouter";
export type CacheStatus = "hit" | "miss" | "stale";

// ── INPUT CONTRACT ────────────────────────────────────────────────────────────
export interface AnalysisRequest {
  claim: string;          // Raw user input
  sessionId?: string;     // Hashed session identifier
  ipHash?: string;        // Hashed IP for rate limiting
}

export interface NormalizedClaim {
  original: string;
  normalized: string;
  hash: string;           // SHA-256 of normalized
  intent: ClaimIntent;
  category: ClaimCategory;
  isCheckable: boolean;   // False for pure opinions/satire
  clarificationNeeded: boolean;
  clarificationHint?: string;
  keyEntities: string[];
  searchQueries: string[];
  wikiQuery: string;
}

// ── SOURCE CONTRACT ───────────────────────────────────────────────────────────
export interface RawSource {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  domain: string;
  sourceType: SourceType;
}

export interface ScoredSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  stance: SourceStance;
  credibility: number;       // 1-5
  sourceType: SourceType;
  recencyScore: number;      // 0-100
  relevanceScore: number;    // 0-100
  publishedAt?: string;
}

// ── EVIDENCE CONTRACT ─────────────────────────────────────────────────────────
export interface EvidenceBundle {
  sources: ScoredSource[];
  supporting: ScoredSource[];
  opposing: ScoredSource[];
  neutral: ScoredSource[];
  factChecks: FactCheckResult[];
  wikiContext: WikiContext | null;
  hasConflict: boolean;
  evidenceStrength: "strong" | "moderate" | "weak" | "none";
}

export interface FactCheckResult {
  claimText: string;
  rating: string;
  publisher: string;
  url: string;
  reviewDate?: string;
}

export interface WikiContext {
  title: string;
  extract: string;
  url: string;
  thumbnailUrl?: string;
  lastModified?: string;
}

// ── REASONING CONTRACT ────────────────────────────────────────────────────────
export interface ReasoningStep {
  step: string;
  icon: string;
  color: string;
  text: string;
}

// ── EVIDENCE BREAKDOWN ────────────────────────────────────────────────────────
export interface EvidenceBreakdown {
  supporting: number;  // 0-100
  opposing: number;    // 0-100
  consensus: number;   // 0-100
  quality: number;     // 0-100
}

// ── RADAR SCORES ──────────────────────────────────────────────────────────────
export interface RadarScores {
  accuracy: number;      // 0-100
  diversity: number;     // 0-100
  consensus: number;     // 0-100
  recency: number;       // 0-100
  verifiability: number; // 0-100
}

// ── ANALYSIS RESULT ───────────────────────────────────────────────────────────
export interface AnalysisResult {
  verdict: Verdict;
  confidence: number;         // 0-100
  headline: string;
  summary: string;
  category: ClaimCategory;
  reasoning: ReasoningStep[];
  sources: ScoredSource[];
  factChecks?: FactCheckResult[];
  evidenceBreakdown: EvidenceBreakdown;
  radar: RadarScores;
  warnings: string[];
  cacheStatus: CacheStatus;
  latencyMs: number;
  synthesisMode: SynthesisMode;
}

// ── PROVIDER INTERFACES ───────────────────────────────────────────────────────
export interface SearchProvider {
  name: string;
  search(query: string, limit?: number): Promise<RawSource[]>;
  isAvailable(): boolean;
}

export interface FactCheckProvider {
  name: string;
  query(claim: string): Promise<FactCheckResult[]>;
  isAvailable(): boolean;
}

export interface ContextProvider {
  name: string;
  getContext(query: string): Promise<WikiContext | null>;
  isAvailable(): boolean;
}

export interface SynthesisProvider {
  name: string;
  synthesize(
    claim: NormalizedClaim,
    evidence: EvidenceBundle
  ): Promise<Omit<AnalysisResult, "cacheStatus" | "latencyMs" | "synthesisMode">>;
  isAvailable(): boolean;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

export interface QuotaProvider {
  check(key: string, limit: number, windowSeconds: number): Promise<QuotaResult>;
  increment(key: string, windowSeconds: number): Promise<void>;
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ── ERROR TYPES ───────────────────────────────────────────────────────────────
export type TruthLensErrorCode =
  | "RATE_LIMITED"
  | "BUDGET_EXCEEDED"
  | "CLAIM_TOO_SHORT"
  | "CLAIM_TOO_LONG"
  | "CLAIM_UNCHECKABLE"
  | "RETRIEVAL_FAILED"
  | "SYNTHESIS_FAILED"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR";

export interface TruthLensError {
  code: TruthLensErrorCode;
  message: string;
  retryAfter?: number;
}

// ── API RESPONSE SHAPE ────────────────────────────────────────────────────────
export interface ApiSuccess {
  ok: true;
  data: AnalysisResult;
}

export interface ApiError {
  ok: false;
  error: TruthLensError;
}

export type ApiResponse = ApiSuccess | ApiError;

// ── HISTORY ───────────────────────────────────────────────────────────────────
export interface HistoryItem {
  id: string;
  claimPreview: string;
  verdict: Verdict;
  confidence: number;
  createdAt: string;
}

# FakeNewzz 🛡️

**FakeNewzz** is an open-source, evidence-based news verification engine. It decomposes news articles, headlines, and claims into atomic assertions, cross-references them against independent primary sources, international wires, and official gazettes, and computes a transparent, deterministic trust score with zero LLM score hallucinations.

---

## How It Works

FakeNewzz follows a rigorous, multi-stage verification pipeline:

```
[News URL / Headline / Text]
             │
             ▼
1. INGESTION & READABILITY (Firecrawl + Direct Fallback + SSRF Protection)
             │
             ▼
2. CLAIM EXTRACTION (Atomic assertion decomposition & layer classification)
             │
             ▼
3. MULTI-SOURCE SEARCH (Dual-direction retrieval: support + challenge/fact-checks)
             │
             ▼
4. EVIDENCE RANKING & SYNDICATION DEDUPLICATION (Cluster independent sources)
             │
             ▼
5. CLAIM EVALUATION (Entailment-based evaluation against strictly supplied evidence)
             │
             ▼
6. OMISSION & CONTEXT ANALYSIS (Identify missing critical qualifiers or timeline shifts)
             │
             ▼
7. DETERMINISTIC SCORING & 100-GATE VERIFICATION (Math-only scoring; pure functions)
             │
             ▼
8. VERDICT, CONCLUSION & EDITORIAL SUMMARY
```

### Key Principles
- **Zero-Hallucination Scoring**: The language model never determines or outputs the numeric score or verdict. Scores are computed using pure mathematical formulas from verified evidence citations and cluster counts.
- **Strict Entailment**: Sources are evaluated for whether they actually state the claim, contradict it, or merely mention the general topic. Mere topic overlap does not count as supporting evidence.
- **Syndication Independence**: 10 syndicated copies of the same wire service count as one independent voice, preventing echo chambers from inflating trust.
- **The 100-Gate**: A score of 100 is impossible without multiple independent source clusters, zero unresolved conflicts, and verification of all core factual dimensions.

---

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- npm, pnpm, or yarn

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/fakenewzz.git
cd fakenewzz
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and configure your API keys:
```bash
cp .env.example .env.local
```

Required & optional variables:
- `FIRECRAWL_API_KEY`: For web scraping and article text extraction ([Firecrawl](https://firecrawl.dev)).
- `SERPER_API_KEY`: For real-time Google News & Web evidence search ([Serper](https://serper.dev)).
- `GOOGLE_GENERATIVE_AI_API_KEY`: Primary LLM for structured claim evaluation ([Google AI Studio](https://aistudio.google.com)).
- `ANTHROPIC_API_KEY`: Fallback LLM provider ([Anthropic](https://console.anthropic.com)).
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: For distributed per-IP rate limiting and daily budget protection ([Upstash](https://upstash.com)).

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Running Tests & Benchmarks
```bash
# Run the complete test suite (250+ unit and integration tests)
npm test

# Run the verification benchmark suite
npm run benchmark

# Run quick benchmark
npm run benchmark:quick
```

---

## Project Structure

```
├── src/
│   ├── app/                      # Next.js App Router (pages & API endpoints)
│   │   ├── api/
│   │   │   ├── article/          # Article extraction & metadata recovery
│   │   │   ├── claims/           # Atomic claim decomposition
│   │   │   ├── context/          # Material context & omission analysis
│   │   │   ├── evaluate/         # Evidence-grounded claim evaluation
│   │   │   ├── image/            # SSRF-protected image proxy
│   │   │   ├── search/           # Multi-source evidence retrieval
│   │   │   └── verify/           # Orchestrated verification pipeline
│   │   └── page.tsx              # Main interactive verification dashboard
│   ├── components/               # React UI components (editorial dark theme)
│   ├── lib/
│   │   ├── comparison/           # Cross-source clustering & disagreement engine
│   │   ├── ingestion/            # URL safety, SSRF validation & page fetchers
│   │   ├── ratelimit/            # Upstash Redis per-IP rate limiting & budget guards
│   │   ├── scoring/              # Deterministic scoring, 100-gate & verdict logic
│   │   ├── search/               # Serper provider & evidence ranking
│   │   └── verification/         # Report generation, summaries & conclusion labels
│   └── schemas/                  # Zod validation schemas for all data models
├── tests/                        # Comprehensive test suites & benchmark datasets
└── public/                       # Static assets
```

---

## Limitations & Disclaimer

> [!IMPORTANT]
> **FakeNewzz is an algorithmic decision aid, not an infallible arbiter of truth.**
>
> 1. **Dependent on Public Reporting**: FakeNewzz checks claims against publicly accessible, indexed web sources. Developing breaking news, restricted government records, or stories in languages/regions with limited digital coverage may result in an `Unconfirmed` or `Can't verify` verdict.
> 2. **Not a Substitute for Human Editorial Judgment**: Algorithmic cross-referencing helps identify contradictions, missing context, and wire syndication patterns, but cannot replace primary investigative reporting or professional judgment.
> 3. **Coordinated Disinformation**: If false information is simultaneously seeded across dozens of distinct, seemingly independent domains before fact-checks appear, cross-source heuristics may require subsequent debunking coverage to detect the fabrication.

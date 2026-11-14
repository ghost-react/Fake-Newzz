# Product Requirements Document (PRD) — FakeNewzz

**Project Name:** FakeNewzz

**Version:** 1.0.0

**Status:** Approved for Development

**Target Platform:** Web Application (Responsive Next.js Dashboard)

**Primary Tech Stack:** Next.js (App Router), Tailwind CSS, Shadcn UI, Tavily/Exa API, Firecrawl, LLM (Gemini 2.0 / Claude 3.5 Sonnet)

---

## 1. Executive Summary & Problem Statement

### Problem

Mainstream media outlets and social media channels frequently publish sensationalized, partisan, or selectively edited news. Misinformation spreads rapidly through omitted context, out-of-context quotes, and unverified claims. Users lack an automated, objective tool to cross-examine claims across independent sources, international coverage, and primary records in real time.

### Solution

**FakeNewzz** is an AI-powered news cross-verification platform built via vibecoding and modern LLM APIs. It ingests news URLs or raw claim text, extracts atomic testable assertions, performs multi-source web retrieval across independent and global registries, and returns an explainable veracity score with side-by-side evidence tracking and context-omission alerts.

---

## 2. Target User Personas

| Persona | Role & Needs | Core Pain Point |
| --- | --- | --- |
| **The Informed Citizen** | Seeks unbiased news updates; wants to verify viral WhatsApp/X clips and headlines quickly. | Cannot easily distinguish between actual events and partisan spin/omissions. |
| **Student / Researcher** | Needs cross-referenced sources and primary documentation for academic or analytical work. | Time-consuming to search 10+ independent news sites manually for every claim. |
| **Content Creator / Journalist** | Fact-checks breaking news before resharing or publishing commentary. | High risk of reputational damage if reshared news turns out to be fabricated or misleading. |

---

## 3. Core System Architecture & Workflow

The platform operates as a deterministic **Extraction → Search → Cross-Verification → Explainability** pipeline rather than relying on an LLM's internal static training memory.

```
[ User Input: URL or Raw Text ]
              │
              ▼
    [ Content Ingestion Engine ] ──(Firecrawl / Jina Reader)
              │
              ▼
 [ Atomic Claim Extraction Agent ] ──(LLM decomposes story into claims)
              │
              ▼
   [ Real-Time Search Orchestrator ] ──(Tavily / Exa APIs: Independent & Fact-Check DBs)
              │
              ▼
  [ Cross-Verification & Omission Engine ] ──(Stance analysis + Context evaluation)
              │
              ▼
  [ Explainable UI Scorecard ] ──(Next.js Dashboard + Split Source View)

```

---

## 4. Feature Specifications & Functional Requirements

### 4.1 URL & Raw Text Ingestor

* **Requirement:** Accept article URLs, raw headlines, or pasted text snippets up to 5,000 words.
* **Mechanism:**
* Clean clutter, popups, and paywall banners using web-scraping pipelines.
* Extract metadata: Publication title, author, publication timestamp, and core body text.


* **Acceptance Criteria:** Successfully parses clean body text from major news portals within 3 seconds.

### 4.2 Atomic Claim Decomposition Engine

* **Requirement:** Break raw articles into individual, testable core statements.
* **Output Format:** Array of structured claim objects (e.g., `Claim 1: Government announced X policy on Date Y`).
* **Logic:** Filter out subjective opinions or speculative adjectives, isolating strictly factual assertions.

### 4.3 Multi-Source Search Orchestrator

* **Requirement:** For every extracted atomic claim, trigger real-time, parallel web queries across diverse media tiers:
* **Tier 1:** Independent domestic news outlets & regional coverage.
* **Tier 2:** International wire services (e.g., Reuters, AP News, AFP).
* **Tier 3:** Verified fact-checking archives (e.g., Alt News, Boom Live, Snopes).
* **Tier 4:** Official government portals, gazettes, and official press releases (press information bureaus).



### 4.4 Contextual Verification & Omission Detector

* **Requirement:** Classify every atomic claim into one of four veracity states:
1. **Verified True:** Supported by 2+ independent Tier 1/2 sources or official records.
2. **Contradicted / False:** Directly disproved by primary evidence or multiple independent reports.
3. **Context Missing / Misleading:** Claim is partially true but suppresses critical qualifying facts.
4. **Unverified:** Insufficient live web evidence to validate or deny.


* **Omission Alert:** Explicitly flag suppressed facts (e.g., *"Article mentions X tax increase but omits that Y income threshold is exempt"*).

### 4.5 Explainable UI & Veracity Scorecard

* **Veracity Gauge:** Visual overall trust rating (0–100%) computed from atomic claim scores.
* **Claim Breakdown Matrix:** Collapsible cards for each extracted claim with direct citation badges.
* **Split-View Coverage Matrix:** Side-by-side comparison showing how different media outlets reported the exact same event.

---

## 5. API Data Model Contract (`/api/verify`)

```json
{
  "request": {
    "inputType": "url",
    "content": "https://example-news-site.com/article/12345"
  },
  "response": {
    "articleTitle": "Extracted Headline Here",
    "sourceDomain": "example-news-site.com",
    "overallTrustScore": 42,
    "veracityVerdict": "Misleading (Selective Context Removed)",
    "summary": "The article's primary claim regarding tax hikes is technically true but omits key statutory exemptions reported by official sources.",
    "atomicClaims": [
      {
        "claimId": "C1",
        "claimText": "Tax rate was increased to 25% for all citizens.",
        "status": "Context Missing",
        "evidenceSummary": "The tax rate applies only to brackets above ₹15 Lakhs; lower income brackets remain unaffected.",
        "sources": [
          { "name": "Official Press Release", "url": "https://pib.gov.in/example", "type": "Official" },
          { "name": "Reuters", "url": "https://reuters.com/example", "type": "Tier 2" }
        ]
      }
    ],
    "omittedContext": [
      "Fails to state that the directive is optional for small businesses.",
      "Omits official timeline of implementation starting next fiscal year."
    ]
  }
}

```

---

## 6. Non-Functional Requirements & Guardrails

| Metric / Category | Target Requirement |
| --- | --- |
| **Latency** | Full extraction, multi-query search, and LLM evaluation within 8–12 seconds. |
| **Objectivity Guardrail** | System prompt must explicitly prohibit AI bias or political commentary; output must stick to direct quote comparisons. |
| **Zero Hallucination Rule** | If no web source corroborates a claim, force status to `"Unverified"` instead of guessing. |
| **Scalability** | Serverless API handlers deployed on Vercel with caching (Redis/Upstash) for repeatedly searched URLs. |

---

## 7. Vibecoding Prompt Engineering Strategy

To build **FakeNewzz** rapidly using AI builders like Cursor, Vercel v0, or Antigravity, use this prompt roadmap:

1. **Step 1 (UI Prototype):** *"Create a Next.js 14 App Router dashboard with Tailwind CSS and Shadcn UI. Build an input form for news URLs, a central veracity percentage dial, an atomic claims list with color-coded status badges (Green=Verified, Red=False, Yellow=Context Missing), and a side-by-side news outlet comparison view."*
2. **Step 2 (API Routes & Ingestion):** *"Write a Next.js serverless route at `/api/verify` that takes a URL, calls Firecrawl API to extract clean markdown, and passes it to an LLM to extract atomic claims into a JSON array."*
3. **Step 3 (Search Integration):** *"Integrate Tavily Search API into `/api/verify`. For each atomic claim extracted, run a query and feed the search snippets back into the LLM prompt to compute claim statuses and evidence links."*

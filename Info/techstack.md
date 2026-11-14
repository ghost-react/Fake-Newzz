Here is the complete, modern tech stack designed specifically for **FakeNewzz**. This stack is optimized for **vibecoding** (fast execution using AI tools like Cursor, Antigravity, and Vercel v0) while staying production-ready, performant, and cost-effective.

---

## 🛠️ Complete Tech Stack Architecture for FakeNewzz

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14+)                          │
│          Tailwind CSS + Shadcn UI + Framer Motion + Lucide             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Next.js Route Handlers)                    │
│                 Vercel AI SDK + Zod Structured Output                  │
└──────┬───────────────────────────┬──────────────────────────────┬──────┘
       │                           │                              │
       ▼                           ▼                              ▼
┌──────────────┐          ┌─────────────────┐          ┌──────────────────┐
│   SCRAPING   │          │  WEB SEARCH API │          │   LLM REASONING  │
│  Firecrawl / │          │ Tavily / Exa AI │          │ Gemini 2.0 Flash │
│  Jina Reader │          │   (Fact Search) │          │ Claude 3.5 Sonnet│
└──────────────┘          └─────────────────┘          └──────────────────┘
       │                           │                              │
       └───────────────────────────┼──────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      DATABASE & SPEED CACHING                          │
│               Upstash Redis (Cache Viral Articles)                     │
│              Supabase / Neon Postgres (Saved Reports)                  │
└────────────────────────────────────────────────────────────────────────┘

```

---

### 1. Frontend & UI Layer

| Technology | Purpose | Why Selected for FakeNewzz |
| --- | --- | --- |
| **Next.js 14+ (App Router)** | Core Web Framework | React-based server components ensure fast SSR page loads and clean serverless API routing. |
| **Tailwind CSS** | Utility-first Styling | Allows rapid visual styling directly via AI prompts (vibecoding). |
| **Shadcn UI + Radix UI** | UI Component Library | Copy-paste accessible components (dialogs, accordions, badges, tabs) ideal for structured report cards. |
| **Framer Motion** | Visual Animations | Smooth gauge meter animations for truth scores, loading states, and collapsible claim cards. |
| **Lucide React** | Iconography | Clean, modern iconography for verification badges (Check, X, AlertTriangle, ShieldCheck). |

---

### 2. AI Engine & Orchestration

| Technology | Purpose | Why Selected for FakeNewzz |
| --- | --- | --- |
| **Vercel AI SDK (`ai`)** | AI Pipeline & Streaming | Simplifies LLM integration with unified `generateObject` and `streamObject` functions. |
| **Zod** | Schema Validation | Enforces strict, typed JSON output from the LLM so the UI never breaks when rendering claim lists. |
| **Gemini 2.0 Flash / Claude 3.5 Sonnet** | Primary Fact-Checking Models | **Gemini 2.0 Flash** offers ultra-fast extraction and low latency, while **Claude 3.5 Sonnet** excels at complex nuance and context-omission analysis. |

---

### 3. Data Ingestion & Live Web Retrieval

| Technology | Purpose | Why Selected for FakeNewzz |
| --- | --- | --- |
| **Firecrawl API** / **Jina Reader (`r.jina.ai`)** | Article Content Scraper | Converts any news URL into clean, markdown-formatted body text, stripping away paywall overlays, ads, and cookies. |
| **Tavily Search API** | Real-time Search Engine | Purpose-built search API for LLMs. Returns clean, relevant web snippets from news archives and official portals without SEO noise. |
| **Exa AI API (Optional)** | Semantic Search | Allows neural searches for primary documents and official gazette notifications matching atomic claims. |

---

### 4. Database, Caching & Storage

| Technology | Purpose | Why Selected for FakeNewzz |
| --- | --- | --- |
| **Upstash Redis** | Result Caching | Caches fact-check reports based on URL hashes. If a breaking article goes viral, subsequent users get instant (<100ms) cached results without re-running expensive search queries. |
| **Supabase / Neon DB (PostgreSQL)** | Database | Stores saved fact-checks, public user verification feeds, and user bookmarked reports. |

---

### 5. Deployment, Hosting & Vibecoding Ecosystem

| Tool | Role | Function |
| --- | --- | --- |
| **Vercel** | Platform & Hosting | Automatic CI/CD deployment on every GitHub push, serverless function scaling, and zero-config environment variables. |
| **Cursor / Antigravity** | AI IDE & Coding | Primary environment for prompt-driven development, auto-generating API routes, and styling UI. |
| **Vercel v0 / Bolt.new** | Rapid Prototyping | Generates complex UI components (e.g., veracity dashboard layout, claim cards) from natural language prompts. |

---

## 📦 Package Dependencies (`package.json`)

Here is the exact set of dependencies to install when setting up the project repository:

```bash
# Core App & UI
npm install next react react-dom lucide-react framer-motion clsx tailwind-merge

# Shadcn UI primitives
npm install @radix-ui/react-accordion @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-progress

# AI & Validation
npm install ai @ai-sdk/google @ai-sdk/anthropic zod

# Web Retrieval & Caching
npm install @tavily/core @upstash/redis @supabase/supabase-js

```

---

## 🚀 Key Advantages of This Stack

1. **Zero Hallucination Risk:** By combining **Firecrawl** (for raw text) + **Tavily API** (for live ground truth) + **Zod Schema** (for strict LLM JSON formatting), the AI cannot make up facts—it only evaluates live search evidence.
2. **Ultra Low Latency:** Gemini 2.0 Flash combined with Upstash Redis caching keeps API responses under 3 seconds for new URLs and under 100ms for viral cached stories.
3. **Optimized for Vibecoding:** Next.js + Tailwind + Shadcn UI can be 90% generated using Cursor or v0 prompts without writing repetitive boilerplate code.
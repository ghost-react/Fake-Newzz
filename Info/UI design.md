# UI Design Document: FakeNewzz

**Project Name:** FakeNewzz

**Document Type:** User Interface & Visual Design Specification

**Design Reference:** Dribbble Concept — *News Coverage Layout*

**Theme:** Dark Editorial Glassmorphism with Dynamic Hero Media Backgrounds

---

## 1. Design Vision & Concept Direction

The visual language of **FakeNewzz** blends a high-density investigative editorial aesthetic with modern glassmorphic dashboard controls. Inspired by the *News Coverage* Dribbble layout, the interface focuses on **side-by-side media comparison**, **atomic stance tracking**, and **visual clarity**.

### Key Concept: Dynamic Article Background Engine

When a user submits a news link, the application automatically extracts the article’s lead featured image and transforms it into a dynamic, ambient background layer behind the main summary banner.

* **Default State:** A deep space-slate gradient background (`#0B0F17`) with ambient indigo and emerald mesh blurs.
* **Active Fact-Check State:** The background transitions smoothly to the extracted article lead image, styled with a heavy dark vignette (`rgba(11, 15, 23, 0.85)`), backdrop blur (`32px`), and dynamic color tint matching the final Veracity Score.

---

## 2. Color Palette & Typography System

### 2.1 Color Tokens

| Token Name | Hex Code | Purpose / Application |
| --- | --- | --- |
| **Canvas Dark** | `#0B0F17` | Main dashboard background. |
| **Glass Card Fill** | `rgba(255, 255, 255, 0.04)` | Container panels and comparison cards. |
| **Glass Card Border** | `rgba(255, 255, 255, 0.08)` | Subdued border lines for card elevation. |
| **Verified Green** | `#10B981` / `#059669` | High trust scores, verified true claims, and supportive coverage badges. |
| **Context Missing Amber** | `#F59E0B` / `#D97706` | Partial truth, omitted context, and selective framing alerts. |
| **Fake / False Red** | `#EF4444` / `#DC2626` | Contradicted claims, fabricated headlines, and debunked statements. |
| **Unverified Slate** | `#64748B` | Insufficient web evidence or pending analysis. |
| **Text Primary** | `#F8FAFC` | Main headings and article titles. |
| **Text Muted** | `#94A3B8` | Metadata, domain badges, and timestamps. |

### 2.2 Typography Hierarchy

* **Headings (Editorial Serif):** *Newsreader* or *Playfair Display* (Google Fonts) — Used for news article titles, verified verdict banners, and key takeaways to retain journalistic weight.
* **Interface & Data (Clean Sans):** *Inter* or *Plus Jakarta Sans* — Used for claims tables, accuracy meters, percentage badges, source links, and code structures.

---

## 3. Layout Architecture & Component Hierarchy

The UI is structured as a single-page responsive dashboard divided into 5 distinct zones:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ZONE 1: Header Bar (Logo, Live Ticker, Saved Reports, Theme Toggle)         │
├──────────────────────────────────────────────────────────────────────────────┤
│  ZONE 2: Dynamic Hero Search & Ingestion Bar                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ZONE 3: Veracity Scorecard & Dynamic Article Background Banner              │
│  ┌─────────────────────────────────┬──────────────────────────────────────┐  │
│  │ Circular Veracity Radial Gauge  │ Extracted Article Summary & Metadata │  │
│  └─────────────────────────────────┴──────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  ZONE 4: Atomic Claim Breakdown Matrix (Expandable Accordion Cards)          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ZONE 5: Multi-Outlet Coverage Comparison (Dribbble Grid Concept)            │
│  ┌───────────────────┬───────────────────┬───────────────────┐               │
│  │  Media Outlet A    │  Media Outlet B    │  Media Outlet C    │               │
│  │  (Pro-Government) │  (Independent)    │  (International)  │               │
│  └───────────────────┴───────────────────┴───────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────┘

```

---

## 4. Component Design Specifications

### Component 1: Dynamic Article Background & Hero Banner

* **Visual Styling:**
* Background image container set to `position: absolute`, inset `0`, with `object-fit: cover`.
* Multi-layer overlay mask:
* `backdrop-filter: blur(24px) brightness(0.4)`
* `background: linear-gradient(180deg, rgba(11,15,23,0.6) 0%, #0B0F17 100%)`




* **Contents:**
* **Left Side:** An animated circular SVG progress gauge displaying the **Overall Trust Score (0–100%)**. Color scales dynamically from Red (`<40%`) to Amber (`40–70%`) to Green (`>70%`).
* **Right Side:** Extracted article headline rendered in *Newsreader Serif*, source domain badge (e.g., `theguardian.com`), publication date, and reading length.



### Component 2: Search & Link Ingestion Bar

* **Visual Styling:**
* Centered floating glass capsule with sub-pixel border glow.
* Inputs supported: Web URL paste or raw headline text input.
* CTA Button: *"Fact-Check News"* with an animated sparkling AI icon.


* **Micro-Interaction:** On click, button displays an active pulsing glowing ring while the scraper fetches content and transitions the page background.

### Component 3: Atomic Claims Accordion Matrix

* **Visual Styling:**
* Clean stacked list where each row represents a standalone claim extracted from the article.
* **Left Badge:** Visual status label (`VERIFIED`, `CONTEXT MISSING`, `FALSE`, `UNVERIFIED`).
* **Body:** Claim text rendered in clean sans-serif.
* **Expandable Drawer:** On click, expands to reveal:
* Exact quote from original article.
* Counter-evidence snippets retrieved from search APIs.
* Direct external source citation links with favicons.





### Component 4: Multi-Outlet Coverage Grid (Dribbble Concept Inspiration)

* **Purpose:** Directly implements the Dribbble *News Coverage* layout concept by displaying how different mainstream, independent, and international outlets reported the same event.
* **Card Anatomy:**
* **Header:** Outlet Name & Logo (e.g., *Reuters*, *The Hindu*, *BBC*, *Local Gazette*).
* **Stance Tag:** Color-coded pill (`SUPPORTIVE`, `CRITICAL`, `NEUTRAL`, `OMITTED COVERAGE`).
* **Headline Comparison:** How this specific outlet phrased their headline.
* **Coverage Framing Note:** AI-generated summary of framing bias (e.g., *"Focuses heavily on police statements while omitting protestor interviews"*).



### Component 5: Omitted Context Callout Box

* **Visual Styling:**
* Framed in an Amber glass container with a glowing warning border (`border-amber-500/30`).
* Displays bulleted list of critical facts disproved or suppressed by the submitted article.



---

## 5. Responsive Behavior & UI States

| Screen Width | Layout Adjustments |
| --- | --- |
| **Desktop (`>1280px`)** | Full 3-column coverage grid side-by-side, large radial veracity dial (200px), visible split view. |
| **Tablet (`768px – 1279px`)** | 2-column coverage grid, collapsed claim accordions by default. |
| **Mobile (`<767px`)** | Single column stacked view. Coverage cards turn into a horizontally swipeable carousel. Search bar sticks to top during scroll. |

---

## 6. Implementation Guidelines for AI Code Builders

When feeding this UI specification into **Vercel v0**, **Bolt.new**, or **Cursor**, use the following styling prompt guidelines:

```typescript
// Tailwind Class Blueprint for Dynamic Hero Banner
<div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-8 backdrop-blur-xl">
  {/* Dynamic Background Image Layer */}
  <div 
    className="absolute inset-0 z-0 bg-cover bg-center blur-2xl opacity-30 transition-all duration-700"
    style={{ backgroundImage: `url(${extractedArticleImageUrl || '/default-bg.jpg'})` }}
  />
  <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-slate-950" />

  {/* Foreground Content */}
  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
    {/* Veracity Gauge & Metadata */}
  </div>
</div>

```
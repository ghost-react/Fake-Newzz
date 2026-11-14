"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  ExternalLink,
  AlertTriangle,
  Info,
  ArrowLeft,
  CheckCircle2,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import { VerificationReport } from "@/schemas/verification";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { getVerdictContent } from "@/lib/ui/verdictContent";
import {
  BackdropConfig,
  DEFAULT_BACKDROP_CONFIG,
  getEffectiveBackdropConfig,
} from "@/lib/ui/backdropConfig";
import { SourceLink, SyndicatedOutlet } from "@/components/ui/SourceLink";
import { formatRelativeTime } from "@/lib/ui/sourceCardConfig";
import { isSocialOrAggregator } from "@/lib/comparison/socialExclusion";
import { cn } from "@/lib/utils";

export interface NewsBackdropProps {
  report: VerificationReport;
  config?: Partial<BackdropConfig>;
  claims?: ClaimInput[];
  evidence?: Evidence[];
  onReset?: () => void;
  onOpenMethodology?: () => void;
  onSearch?: (input: string) => void;
  className?: string;
}

/**
 * ScrollDarkenLayer manages progressive background darkening on scroll.
 * Isolated in a sub-component so NewsBackdrop stays purely evaluable in Node test runners.
 */
function ScrollDarkenLayer({ maxDarken }: { maxDarken: number }) {
  const [darken, setDarken] = useState(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset || 0;
          // Progressively darkens up to maxDarken over 450px of scroll
          const progress = Math.min(1, Math.max(0, scrollY / 450));
          setDarken(progress * maxDarken);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [maxDarken]);

  return (
    <div
      data-testid="hero-scroll-darken-layer"
      className="absolute inset-0 z-[2] bg-[#0B0F17] pointer-events-none transition-opacity duration-150 motion-reduce:transition-none"
      style={{ opacity: darken }}
    />
  );
}

export function NewsBackdrop({
  report,
  config,
  claims = [],
  evidence = [],
  onReset,
  onOpenMethodology,
  onSearch,
  className,
}: NewsBackdropProps) {
  // 1. Resolve image source priority:
  //    a. Article lead photo (report.featuredImage)
  //    b. Background image metadata from related reports
  //    c. Fallback: null (dark gradient hero with same layout)
  const rawImageUrl = report.featuredImage || report.backgroundImage?.url || null;
  const imageCredit = report.backgroundImage?.credit || report.sourceDomain;
  const imageLuminance = report.backgroundImage?.luminance;

  // 2. Compute effective backdrop parameters (with luminance-based adaptive scrim boost)
  const effectiveConfig = getEffectiveBackdropConfig(config, imageLuminance);

  // 3. Verdict presentation data
  const verdictInfo = getVerdictContent(report.veracityVerdict);
  const heroLabel = report.conclusion?.label || verdictInfo.label;
  const heroMeaning = report.conclusion?.explanation || verdictInfo.oneLineMeaning;

  // 4. Extract comparison sources for the bottom strip (up to 3 cards)
  interface ComparisonSourceCard {
    id: string;
    domain: string;
    headline: string;
    status: string;
    statusColor: string;
    url?: string;
    originType?: string;
    isWireSyndicated?: boolean;
    isIndependent?: boolean;
    publishedAt?: string | null;
    syndicatedOutlets?: SyndicatedOutlet[];
  }

  const comparisonSources: ComparisonSourceCard[] = (() => {
    if (!report.comparison && !report.crossSourceComparison) {
      return [];
    }

    // A. Check CrossSourceComparison publications (legacy / primary v1)
    if (
      report.crossSourceComparison?.publications &&
      report.crossSourceComparison.publications.length > 0
    ) {
      return report.crossSourceComparison.publications
        .filter((pub) => !isSocialOrAggregator(pub.domain) && !isSocialOrAggregator(pub.url || ""))
        .slice(0, 3)
        .map((pub, idx): ComparisonSourceCard => {
          const matchingEv = evidence.find((e) => e.domain === pub.domain);
          const evUrl = pub.url || matchingEv?.url || "";

          // Collect syndicated outlets if wire story
          const syndicated = pub.isWireSyndicated
            ? evidence
                .filter((e) => e.domain !== pub.domain && e.sourceRelationship === "syndicated" && e.url && !isSocialOrAggregator(e.domain))
                .map((e) => ({ domain: e.domain, url: e.url, title: e.title }))
            : undefined;

          return {
            id: `pub-${idx}`,
            domain: pub.domain,
            headline: pub.title || matchingEv?.title || report.articleTitle,
            status: pub.isWireSyndicated
              ? "Syndicated"
              : pub.isIndependent
              ? "Corroborated"
              : "Referenced",
            statusColor: pub.isWireSyndicated ? "#64748B" : "#10B981",
            url: evUrl,
            originType: pub.isWireSyndicated
              ? "syndicated"
              : pub.isIndependent
              ? "original"
              : "unknown",
            isWireSyndicated: pub.isWireSyndicated,
            isIndependent: pub.isIndependent,
            publishedAt: matchingEv?.publishedAt || null,
            syndicatedOutlets: syndicated && syndicated.length > 0 ? syndicated : undefined,
          };
        });
    }

    // B. Check ComparisonReport (v2)
    if (report.comparison && report.comparison.claims.length > 0) {
      const extracted: ComparisonSourceCard[] = [];
      const seenDomains = new Set<string>();

      for (const claimComp of report.comparison.claims) {
        for (const dim of claimComp.dimensions) {
          for (const sv of dim.sourceValues) {
            const ev = evidence.find((e) => e.id === sv.evidenceId);
            if (ev && !seenDomains.has(ev.domain)) {
              const isSocial = isSocialOrAggregator(ev.domain) || isSocialOrAggregator(ev.url);
              if (isSocial) continue;

              seenDomains.add(ev.domain);
              const isSyndicated = ev.sourceRelationship === "syndicated";
              const isIndep = ev.sourceRelationship === "independent" || ev.sourceRelationship === "original";

              extracted.push({
                id: ev.id,
                domain: ev.domain,
                headline: ev.title,
                status: isSyndicated
                  ? "Syndicated"
                  : dim.outcome === "agreement"
                  ? "Agrees"
                  : dim.outcome === "contradiction"
                  ? "Conflicts"
                  : "Context",
                statusColor: isSyndicated
                  ? "#64748B"
                  : dim.outcome === "agreement"
                  ? "#10B981"
                  : dim.outcome === "contradiction"
                  ? "#EF4444"
                  : "#F59E0B",
                url: ev.url,
                originType: ev.sourceRelationship,
                isWireSyndicated: isSyndicated,
                isIndependent: isIndep,
                publishedAt: ev.publishedAt || null,
              });
              if (extracted.length >= 3) break;
            }
          }
          if (extracted.length >= 3) break;
        }
        if (extracted.length >= 3) break;
      }

      // If fewer than 3 comparison outlets, include additional non-social evidence
      if (extracted.length < 3) {
        for (const ev of evidence) {
          if (!seenDomains.has(ev.domain) && !isSocialOrAggregator(ev.domain) && !isSocialOrAggregator(ev.url)) {
            seenDomains.add(ev.domain);
            extracted.push({
              id: ev.id,
              domain: ev.domain,
              headline: ev.title,
              status: ev.sourceRelationship === "syndicated" ? "Syndicated" : "Corroborated",
              statusColor: ev.sourceRelationship === "syndicated" ? "#64748B" : "#10B981",
              url: ev.url,
              originType: ev.sourceRelationship,
              isWireSyndicated: ev.sourceRelationship === "syndicated",
              isIndependent: ev.sourceRelationship === "independent" || ev.sourceRelationship === "original",
              publishedAt: ev.publishedAt || null,
            });
            if (extracted.length >= 3) break;
          }
        }
      }

      if (extracted.length > 0) {
        return extracted;
      }
    }

    return [];
  })();

  // 5. Strongest independent source for floating desktop card (strictly excludes social/aggregators)
  const strongestSource = (() => {
    const validFromComparison = comparisonSources.find(
      (s) =>
        !isSocialOrAggregator(s.domain) &&
        (s.isIndependent || s.originType === "original" || s.originType === "independent")
    );
    if (validFromComparison) {
      return validFromComparison;
    }
    const credibleEvidence = evidence.find(
      (e) =>
        !isSocialOrAggregator(e.domain) &&
        (e.sourceRelationship === "independent" || e.sourceRelationship === "original") &&
        e.evidenceQuality === "high" &&
        e.eventMatch !== "different_event" &&
        e.eventMatch !== "related_background"
    );
    if (credibleEvidence) {
      return {
        id: credibleEvidence.id,
        domain: credibleEvidence.domain,
        headline: credibleEvidence.title,
        status: "Strongest Corroboration",
        statusColor: "#10B981",
        url: credibleEvidence.url,
        originType: credibleEvidence.sourceRelationship,
        isIndependent: true,
        isWireSyndicated: false,
      };
    }
    return null;
  })();

  // 6. Right-column summary findings metrics (calculated strictly from report data)
  const findingsSummary = (() => {
    const independentCount =
      report.comparison?.totalIndependentClusters ??
      report.crossSourceComparison?.independentSourcesCount ??
      evidence.filter(
        (e) =>
          !isSocialOrAggregator(e.domain) &&
          (e.sourceRelationship === "independent" || e.sourceRelationship === "original") &&
          e.eventMatch !== "different_event" &&
          e.eventMatch !== "related_background"
      ).length;

    const firstClaimAgreement = report.comparison?.claims?.[0]?.agreementSummary;
    let agreementLabel = "Strong";
    if (firstClaimAgreement) {
      agreementLabel =
        firstClaimAgreement === "strong"
          ? "Strong"
          : firstClaimAgreement === "moderate"
          ? "Moderate"
          : firstClaimAgreement === "weak"
          ? "Weak"
          : "None";
    } else if (report.crossSourceComparison) {
      if (report.crossSourceComparison.claimsConflictingCount > 0) {
        agreementLabel = "Mixed";
      } else if (report.crossSourceComparison.claimsAgreedCount > 0) {
        agreementLabel = "Strong";
      } else {
        agreementLabel = "Consistent";
      }
    }

    const conflictsCount =
      (report.comparison?.totalConflicts ?? report.crossSourceComparison?.claimsConflictingCount ?? 0) +
      (report.comparison?.totalUnresolvedDimensions ?? report.crossSourceComparison?.claimsUnresolvedCount ?? 0);

    return {
      independentCount,
      agreementLabel,
      conflictsCount,
    };
  })();

  const proxiedImageUrl = rawImageUrl
    ? `/api/image?url=${encodeURIComponent(rawImageUrl)}`
    : null;

  const displayCredit =
    imageCredit.startsWith("Photo:") || imageCredit.startsWith("Image from")
      ? imageCredit
      : report.backgroundImage?.sourceType === "evidence"
      ? `Image from a related report: ${imageCredit}`
      : `Photo: ${imageCredit}`;

  const scrollToEvidence = () => {
    if (typeof document !== "undefined") {
      const el =
        document.getElementById("evidence-section") ||
        document.getElementById("cross-source-section");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      data-testid="news-backdrop-hero"
      className={cn(
        "relative w-full overflow-hidden text-[#F5F5F5] select-none",
        // Desktop full-viewport hero (~85vh); Mobile top hero (~55vh)
        "min-h-[55vh] md:min-h-[85vh] flex flex-col justify-between",
        className
      )}
      style={
        {
          "--hero-blur-desktop": `${effectiveConfig.blurPx}px`,
          "--hero-blur-mobile": `${effectiveConfig.mobileBlurPx}px`,
        } as React.CSSProperties
      }
    >
      {/* ── Background Photo Layer (CSS Filter Blur on Single Layer at z-index: 0) ── */}
      {proxiedImageUrl ? (
        <div
          data-testid="hero-image-layer"
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        >
          <img
            src={proxiedImageUrl}
            alt={report.articleTitle}
            className={cn(
              "w-full h-full object-cover",
              "transition-opacity duration-600 motion-reduce:transition-none"
            )}
            style={{
              opacity: effectiveConfig.imageOpacity,
              transform: `scale(${effectiveConfig.scale})`,
              filter: "blur(var(--hero-blur-mobile))",
              objectPosition: effectiveConfig.defaultObjectPosition || "center 30%",
            }}
          />
          {/* Apply desktop blur via scoped style without layout shift */}
          <style jsx>{`
            @media (min-width: 768px) {
              img {
                filter: blur(var(--hero-blur-desktop)) !important;
              }
            }
          `}</style>
        </div>
      ) : (
        /* No-image fallback: dark gradient hero with exact same layout */
        <div
          data-testid="hero-fallback-layer"
          className="absolute inset-0 z-0 bg-gradient-to-br from-[#111923] via-[#0B0F17] to-[#171E29] pointer-events-none"
        >
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        </div>
      )}

      {/* ── Subtle Hero Tone Tint (under 8% opacity, placed behind readability scrims) ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: "radial-gradient(ellipse at 25% 30%, var(--tone, #10B981) 0%, transparent 65%)",
          opacity: 0.05,
        }}
      />

      {/* ── Scrim 1: Left Horizontal Gradient (fades to 0 across ~60% of width) ── */}
      <div
        data-testid="hero-left-scrim"
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `linear-gradient(to right, rgba(11, 15, 23, ${effectiveConfig.leftScrimOpacity}) 0%, rgba(11, 15, 23, ${
            effectiveConfig.leftScrimOpacity * 0.88
          }) 30%, rgba(11, 15, 23, 0.25) 55%, transparent 60%)`,
        }}
      />

      {/* ── Scrim 2: Right Edge Gradient ── */}
      <div
        data-testid="hero-right-scrim"
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `linear-gradient(to left, rgba(11, 15, 23, ${effectiveConfig.rightScrimOpacity}) 0%, transparent 40%)`,
        }}
      />

      {/* ── Scrim 3: Bottom Gradient (fades over bottom ~45% into solid #0B0F17) ── */}
      <div
        data-testid="hero-bottom-scrim"
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, transparent 55%, rgba(11, 15, 23, ${
            effectiveConfig.bottomScrimOpacity * 0.75
          }) 78%, #0B0F17 100%)`,
        }}
      />

      {/* ── Progressive Scroll Darkening Layer (fades backdrop on scroll up to scrollDarkenMax) ── */}
      <ScrollDarkenLayer maxDarken={effectiveConfig.scrollDarkenMax} />

      {/* ── Top Bar: Wordmark centred, search left, nav right, thin divider below ── */}
      <header className="relative z-10 w-full border-b border-[var(--tone-border,rgba(255,255,255,0.2))] bg-[#0B0F17]/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left: Small Search/Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#717B89] absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Verify story, URL or claim..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && onSearch) {
                    onSearch((e.target as HTMLInputElement).value);
                  }
                }}
                className="h-8 pl-8 pr-3 text-xs rounded-lg bg-white/[0.06] border border-white/10 text-[#F5F5F5] placeholder-[#717B89] focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 w-36 sm:w-56 transition-all font-sans"
              />
            </div>
          </div>

          {/* Center: FakeNewzz Wordmark Centred */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-[#F5F5F5]">
              FakeNewzz
            </span>
          </div>

          {/* Right: Minimal Nav */}
          <div className="flex items-center gap-2.5">
            {onOpenMethodology && (
              <button
                type="button"
                onClick={onOpenMethodology}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-sans text-[#A1A1AA] hover:text-[#F5F5F5] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <span>Methodology</span>
              </button>
            )}

            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-medium text-[#A1A1AA] hover:text-[#F5F5F5] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Verify Another</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Tone Accent Line ── */}
      <div className="relative z-10 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--tone,rgba(16,185,129,0.5))] to-transparent opacity-80" />

      {/* ── Center Content Area: Headline, Score, Findings Columns, Floating Card ── */}
      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column over Left Scrim: Spans 7 (min-width 480px, never below 55% of container) */}
          <div className="lg:col-span-7 min-w-0 lg:min-w-[480px] lg:w-full space-y-5">
            {/* Unreadable / Warning Source Note (if applicable) */}
            {(report.sourceReadStatus === "unreadable" ||
              report.sourceReadStatus === "failed" ||
              report.sourceReadStatus === "insufficient" ||
              (report.veracityVerdict === "unverified" && findingsSummary.independentCount === 0)) && (
              <div
                data-testid="unreadable-source-note"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs sm:text-sm text-slate-300 font-medium backdrop-blur-sm shadow-sm"
              >
                <Info className="w-4 h-4 shrink-0 text-slate-400" />
                <span>
                  {report.veracityVerdict === "unverified" && findingsSummary.independentCount === 0
                    ? "No independent reporting of this event was found."
                    : report.sourceReadNote ||
                      "We couldn't read the original article, so this check is based on independent reporting."}
                </span>
              </div>
            )}

            {/* Small-Caps Label Row: Verdict Label and Source Domain */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest font-semibold">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border transition-colors duration-300"
                style={{
                  color: "var(--tone-text, " + verdictInfo.colorToken + ")",
                  borderColor: "var(--tone-border, " + verdictInfo.colorToken + "40)",
                  backgroundColor: "var(--tone-soft, " + verdictInfo.colorToken + "15)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: "var(--tone, " + verdictInfo.colorToken + ")" }}
                />
                <span>{heroLabel}</span>
              </span>

              <span className="text-[#A1A1AA]">·</span>

              <span className="text-[#E2E8F0]">
                {report.sourceDomain}
              </span>

              {report.publishedAt && (
                <>
                  <span className="text-[#64748B]">·</span>
                  <span className="text-[#A1A1AA] lowercase font-normal">{report.publishedAt}</span>
                </>
              )}
            </div>

            {/* Editorial Headline: Large serif (Newsreader) with text-wrap: balance and normal word wrapping */}
            <h1
              data-testid="hero-headline"
              className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-bold text-[#F5F5F5] tracking-tight leading-[1.18] drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] [text-wrap:balance] break-normal"
              style={{ textWrap: "balance" }}
            >
              {report.veracityVerdict === "unverified" && findingsSummary.independentCount === 0
                ? "Unable to verify: no independent reports found."
                : report.articleTitle}
            </h1>

            {/* Score & Meaning Block */}
            <div
              data-testid="hero-score-card"
              className="inline-flex flex-col sm:flex-row sm:items-center gap-5 p-4 sm:p-5 rounded-2xl bg-[#111923]/80 border border-white/[0.14] backdrop-blur-xl shadow-2xl max-w-xl"
            >
              {/* Radial numerical score gauge */}
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex flex-col items-center justify-center border shadow-inner shrink-0 transition-colors duration-300"
                style={{
                  borderColor: "var(--tone-border, " + verdictInfo.colorToken + "40)",
                  backgroundColor: "var(--tone-soft, " + verdictInfo.colorToken + "15)",
                }}
              >
                <span
                  className="text-2xl sm:text-3xl font-mono font-bold tracking-tight transition-colors duration-300"
                  style={{ color: "var(--tone-text, " + verdictInfo.colorToken + ")" }}
                >
                  {report.overallTrustScore}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#A1A1AA]">
                  / 100
                </span>
              </div>

              {/* Verdict text & one-line meaning */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-sans font-bold text-base sm:text-lg text-[#F5F5F5]">
                    {heroLabel}
                  </h3>
                  <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-white/[0.06] text-[#A1A1AA] border border-white/5">
                    {report.confidence} Confidence
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#A1A1AA] font-sans leading-relaxed">
                  {report.veracityVerdict === "unverified" && findingsSummary.independentCount === 0
                    ? "No independent reporting of this event was found."
                    : heroMeaning}
                </p>
              </div>
            </div>

            {/* Two Compact Buttons: "See evidence" and "Original article" */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={scrollToEvidence}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-sans font-medium text-[#F5F5F5] bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 hover:border-[var(--tone-border)] active:bg-[var(--tone-soft)] transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <Database className="w-3.5 h-3.5 text-[var(--tone-text)] transition-colors duration-300" />
                <span>See evidence</span>
              </button>

              {report.articleUrl ? (
                <a
                  href={report.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-sans font-medium text-[#A1A1AA] hover:text-[#F5F5F5] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all cursor-pointer"
                >
                  <span>Original article</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#717B89]" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono text-[#717B89] bg-white/[0.02] border border-white/5">
                  <span>Independent check</span>
                </span>
              )}
            </div>

            {/* Below 1024px: Single column layout where stats become a horizontal scroll row */}
            <div
              data-testid="mobile-stats-row"
              className="flex lg:hidden overflow-x-auto gap-3 pt-2 pb-1 scrollbar-none w-full"
            >
              <div className="min-w-[130px] p-3 rounded-xl bg-[#111923]/80 border border-white/[0.12] backdrop-blur-xl shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block">
                  Independent
                </span>
                <div className="text-xl font-mono font-bold text-[#F5F5F5]">
                  {findingsSummary.independentCount}
                </div>
                <span className="text-[10px] text-[#717B89] font-sans block">outlets verified</span>
              </div>
              <div className="min-w-[130px] p-3 rounded-xl bg-[#111923]/80 border border-white/[0.12] backdrop-blur-xl shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block">
                  Agreement
                </span>
                <div className="text-lg font-mono font-bold text-emerald-400 truncate">
                  {findingsSummary.agreementLabel}
                </div>
                <span className="text-[10px] text-[#717B89] font-sans block">cross-source</span>
              </div>
              <div className="min-w-[130px] p-3 rounded-xl bg-[#111923]/80 border border-white/[0.12] backdrop-blur-xl shrink-0">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block">
                  Unresolved
                </span>
                <div
                  className={cn(
                    "text-xl font-mono font-bold",
                    findingsSummary.conflictsCount > 0 ? "text-[#F59E0B]" : "text-[#F5F5F5]"
                  )}
                >
                  {findingsSummary.conflictsCount}
                </div>
                <span className="text-[10px] text-[#717B89] font-sans block">
                  {findingsSummary.conflictsCount > 0 ? "variations" : "details"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Spans 5 on desktop >=1024px, hidden below 1024px. Normal flow, fixed gap */}
          <div className="hidden lg:flex lg:col-span-5 flex-col gap-5 justify-start">
            {/* 3 Compact Text Columns summarizing strongest findings */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-[#111923]/75 border border-white/[0.12] backdrop-blur-xl shadow-xl">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block">
                  Independent
                </span>
                <div className="text-2xl sm:text-3xl font-mono font-bold text-[#F5F5F5]">
                  {findingsSummary.independentCount}
                </div>
                <span className="text-[11px] text-[#717B89] font-sans block leading-tight">
                  outlets verified
                </span>
              </div>

              <div className="space-y-1 border-l border-white/[0.08] pl-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block">
                  Agreement
                </span>
                <div className="text-xl sm:text-2xl font-mono font-bold text-emerald-400 truncate">
                  {findingsSummary.agreementLabel}
                </div>
                <span className="text-[11px] text-[#717B89] font-sans block leading-tight">
                  cross-source
                </span>
              </div>

              <div className="space-y-1 border-l border-white/[0.08] pl-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] block">
                  Unresolved
                </span>
                <div
                  className={cn(
                    "text-2xl sm:text-3xl font-mono font-bold",
                    findingsSummary.conflictsCount > 0 ? "text-[#F59E0B]" : "text-[#F5F5F5]"
                  )}
                >
                  {findingsSummary.conflictsCount}
                </div>
                <span className="text-[11px] text-[#717B89] font-sans block leading-tight">
                  {findingsSummary.conflictsCount > 0 ? "variations" : "details"}
                </span>
              </div>
            </div>

            {/* Small Floating Glass Card in normal flow below the stats card */}
            {strongestSource && (
              <div
                data-testid="hero-floating-card"
                className="flex justify-end"
              >
                <SourceLink
                  variant="floating-card"
                  url={strongestSource.url}
                  domain={strongestSource.domain}
                  headline={strongestSource.headline}
                  statusText={strongestSource.status}
                  originType={strongestSource.originType}
                  isIndependent={strongestSource.isIndependent}
                  isWireSyndicated={strongestSource.isWireSyndicated}
                  syndicatedOutlets={strongestSource.syndicatedOutlets}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Evidence Strip (3-column grid on desktop, horizontal peek-scroll on mobile, blending with #0B0F17) ── */}
      {comparisonSources.length > 0 && (
        <div
          data-testid="hero-bottom-strip"
          className="relative z-10 w-full border-t border-[var(--tone-border,rgba(255,255,255,0.08))] bg-[#0B0F17]/80 backdrop-blur-xl text-white py-3.5 px-4 sm:px-6 lg:px-8 shadow-2xl transition-colors duration-300"
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A1A1AA] font-bold shrink-0">
                Cross-Source Evidence:
              </span>
              {rawImageUrl && (
                <span
                  data-testid="hero-photo-credit"
                  className="text-[10px] font-mono text-[#717B89] shrink-0 text-right hidden sm:inline"
                >
                  {displayCredit}
                </span>
              )}
            </div>

            {/* 3-Column Grid on desktop (>=768px), Horizontal scroll row on mobile (<768px) */}
            <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible pb-1 md:pb-0 scrollbar-none w-full">
              {comparisonSources.map((source) => (
                <div
                  key={source.id}
                  className="w-[85%] sm:w-[70%] md:w-auto shrink-0 min-w-0"
                >
                  <SourceLink
                    data-testid="hero-source-card"
                    variant="white-strip-card"
                    url={source.url}
                    domain={source.domain}
                    headline={source.headline}
                    statusText={source.status}
                    timeText={formatRelativeTime(source.publishedAt) || undefined}
                    originType={source.originType}
                    isIndependent={source.isIndependent}
                    isWireSyndicated={source.isWireSyndicated}
                    syndicatedOutlets={source.syndicatedOutlets}
                    className="h-full bg-[#111923]/80 hover:bg-[#171E29] border-white/[0.08] hover:border-white/20"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { Article } from "@/schemas/article";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";
import {
  VerificationReport,
  VerificationReportSchema,
  CrossSourceComparison,
  ComparisonReport,
  ScoreV2Result,
} from "@/schemas/verification";
import { calculateScore } from "../scoring/calculateScore";
import { determineVerdict, determineStoryStatus } from "../scoring/determineVerdict";
import { clusterEvidenceIndependence } from "../comparison/independence";
import { generateSummary, SummaryInput } from "./generateSummary";
import { determineConclusion } from "./conclusion";
import { getScoringV2Mode } from "../scoring/config.v2";
import { calculateScoreV2 } from "../scoring/calculateScoreV2";
import { traceStage } from "../debug/trace";
import { isLikelyLogoOrTracker } from "../image/dimensions";
import { resolveHeroPhoto } from "../image/heroPhotoSelection";
import { isSocialOrAggregator } from "../comparison/socialExclusion";

export interface BuildReportOptions {
  customSummaryGenerator?: (input: SummaryInput) => Promise<string>;
  evidence?: Evidence[];
  crossSourceComparison?: CrossSourceComparison;
  comparison?: ComparisonReport;
  sourceReadStatus?:
    | "success"
    | "partial"
    | "failed"
    | "insufficient"
    | "readable"
    | "unreadable"
    | "could_not_read";
  sourceReadNote?: string;
  coreEventGatePassed?: boolean;
  headlineSource?: "metadata" | "url_search" | "url_slug" | null;
  featuredImage?: string | null;
  backgroundImage?: {
    url?: string | null;
    sourceType?: "article" | "evidence" | "fallback";
    credit?: string | null;
    luminance?: number;
    alt?: string;
  };
  imageLuminance?: number;
}

/**
 * Builds the final explainable verification report by orchestrating:
 * 1. Deterministic score calculation (application code, no LLM)
 * 2. Cross-source comparison and source independence analysis
 * 3. Deterministic verdict determination with important-claim overrides
 * 4. Grounded summary generation
 * 5. Strict server-side Zod validation against VerificationReportSchema
 */
export async function buildReport(
  article:
    | Article
    | {
        title: string;
        sourceDomain: string;
        url?: string | null;
        featuredImage?: string | null;
        author?: string | null;
        publishedAt?: string | null;
      },
  claims: ClaimInput[],
  evaluations: ClaimEvaluation[],
  omissions: Omission[],
  options?: BuildReportOptions
): Promise<VerificationReport> {
  // 1. Calculate deterministic score, score breakdown, and cross-source analysis
  const { scoreBreakdown, confidence, claimSummary, scoreExplanation, crossSourceComparison } =
    calculateScore(claims, evaluations, omissions, {
      evidence: options?.evidence,
      crossSourceComparison: options?.crossSourceComparison,
      originalPublisher: article.sourceDomain,
    });

  // 2. Determine verdict with important-claim overrides
  const verdict = determineVerdict(
    scoreBreakdown.finalScore,
    claims,
    evaluations,
    omissions
  );

  // 2.5 Coordinate scoring v2 based on SCORING_V2 flag
  const scoringV2Mode = getScoringV2Mode();

  let finalTrustScore = scoreBreakdown.finalScore;
  let finalVerdict = verdict;
  let finalConfidence = confidence;

  let scoreV2ShadowResult: ScoreV2Result | undefined;
  let scoreV1Result: any | undefined;

  if (scoringV2Mode === "shadow" || scoringV2Mode === "on") {
    scoreV2ShadowResult = calculateScoreV2(claims, evaluations, omissions, {
      comparison: options?.comparison,
      evidence: options?.evidence,
      coverageLimited: options?.comparison?.coverageLimited,
    });

    traceStage("scoring_v2", {
      mode: scoringV2Mode,
      v1: { score: scoreBreakdown.finalScore, verdict, confidence },
      v2: {
        score: scoreV2ShadowResult.overallTrustScore,
        verdict: scoreV2ShadowResult.veracityVerdict,
        confidence: scoreV2ShadowResult.confidence,
        factors: scoreV2ShadowResult.scoreBreakdown.factors,
      },
    });

    if (scoringV2Mode === "on") {
      scoreV1Result = {
        overallTrustScore: scoreBreakdown.finalScore,
        veracityVerdict: verdict,
        confidence,
        scoreBreakdown,
      };
      finalTrustScore = scoreV2ShadowResult.overallTrustScore;
      finalVerdict = scoreV2ShadowResult.veracityVerdict;
      finalConfidence = scoreV2ShadowResult.confidence;
    }
  }

  // Step 4: Hero stat consistency & Positive verdict gating
  const indepClustersCount =
    options?.comparison?.totalIndependentClusters ??
    (options?.evidence !== undefined
      ? clusterEvidenceIndependence(options.evidence).filter(
          (c) => c.originType !== "social_reference" && !isSocialOrAggregator(c.primaryDomain)
        ).length
      : undefined);

  if (indepClustersCount === 0) {
    if (finalVerdict === "verified_true" || finalVerdict === "mostly_true") {
      finalVerdict = "unverified";
    }
    finalConfidence = "low";
    if (scoreV2ShadowResult) {
      if (
        scoreV2ShadowResult.veracityVerdict === "verified_true" ||
        scoreV2ShadowResult.veracityVerdict === "mostly_true"
      ) {
        scoreV2ShadowResult.veracityVerdict = "unverified";
      }
      scoreV2ShadowResult.confidence = "low";
    }
  } else if (indepClustersCount === 1) {
    if (finalConfidence === "high") {
      finalConfidence = "medium";
    }
    if (scoreV2ShadowResult && scoreV2ShadowResult.confidence === "high") {
      scoreV2ShadowResult.confidence = "medium";
    }
  }

  // Guardrail: if headline came only from slug, cap report confidence at "low"
  if (options?.headlineSource === "url_slug") {
    finalConfidence = "low";
    if (scoreV2ShadowResult) {
      scoreV2ShadowResult.confidence = "low";
      scoreV2ShadowResult.headlineSource = "url_slug";
    }
  } else if (options?.headlineSource && scoreV2ShadowResult) {
    scoreV2ShadowResult.headlineSource = options.headlineSource;
  }

  let effectiveSourceReadNote = options?.sourceReadNote;
  const isFailedRead =
    options?.sourceReadStatus === "unreadable" ||
    options?.sourceReadStatus === "failed" ||
    options?.sourceReadStatus === "could_not_read";

  if (indepClustersCount === 0 && !effectiveSourceReadNote) {
    effectiveSourceReadNote = "No independent reporting of this event was found.";
  } else if (isFailedRead && !effectiveSourceReadNote) {
    if (options?.headlineSource === "url_slug") {
      effectiveSourceReadNote =
        "We couldn't read the original article, so this check is based on independent reporting of the same story. The headline was inferred from the link.";
    } else {
      effectiveSourceReadNote =
        "We couldn't read the original article, so this check is based on independent reporting of the same story.";
    }
  } else if (options?.sourceReadStatus === "insufficient" && !effectiveSourceReadNote) {
    effectiveSourceReadNote =
      "The original page did not contain sufficient article text; verified using independent reporting.";
  }

  // 3. Determine story status and deterministic conclusion
  const storyStatus =
    scoreV2ShadowResult?.storyStatus ||
    determineStoryStatus(claims, evaluations, options?.evidence, options?.comparison);

  const conclusion = determineConclusion({
    veracityVerdict: finalVerdict,
    overallTrustScore: finalTrustScore,
    scoreBreakdown,
    gate100Result: scoreV2ShadowResult?.gate100Result,
    verifiedTrue: scoreV2ShadowResult?.verifiedTrue,
    storyStatus,
    claims,
    evaluations,
    comparison: options?.comparison,
    omissions,
    sourceReadStatus: options?.sourceReadStatus,
    sourceReadNote: effectiveSourceReadNote,
    independentClustersCount: indepClustersCount,
  });

  // 4. Generate grounded verification summary
  const summary = await generateSummary({
    article: {
      title: article.title,
      sourceDomain: article.sourceDomain,
    },
    claims,
    evaluations,
    omissions,
    score: finalTrustScore,
    veracityVerdict: finalVerdict,
    confidence: finalConfidence,
    conclusion,
    comparison: options?.comparison,
    sourceReadStatus: options?.sourceReadStatus,
    independentClustersCount: indepClustersCount,
    customGenerator: options?.customSummaryGenerator,
  });

  // 5. Assemble report object with assertion layers and certainty mapped
  const claimLayerMap = new Map(claims.map((c) => [c.id, c.layer || "underlying_fact"]));
  const claimCertaintyMap = new Map(claims.map((c) => [c.id, c.certainty || "asserted_fact"]));
  const enrichedEvaluations = evaluations.map((e) => ({
    ...e,
    layer: e.layer || claimLayerMap.get(e.claimId) || "underlying_fact",
    certainty: e.certainty || claimCertaintyMap.get(e.claimId) || "asserted_fact",
  }));

  // Image source priority resolved via heroPhotoSelection:
  // 1. article.featuredImage (or options.featuredImage)
  // 2. Unreadable article: og:image of highest-ranked same_event readable source (non-social, non-aggregator)
  // 3. Fallback: null (dark gradient hero)
  const resolvedPhoto = resolveHeroPhoto(
    article,
    options?.evidence || [],
    {
      customFeaturedImage: options?.featuredImage,
      customBackgroundImageUrl: options?.backgroundImage?.url,
      customCredit: options?.backgroundImage?.credit,
      luminance: options?.backgroundImage?.luminance ?? options?.imageLuminance,
    }
  );

  const resolvedImageUrl = resolvedPhoto.url;
  const imageSourceType = resolvedPhoto.sourceType;
  const imageCredit = resolvedPhoto.credit;

  const backgroundImageMetadata = resolvedImageUrl
    ? {
        url: resolvedImageUrl,
        sourceType: imageSourceType,
        credit: imageCredit || article.sourceDomain,
        luminance: resolvedPhoto.luminance ?? 0.35,
      }
    : undefined;

  const rawReport: VerificationReport = {
    articleTitle: article.title,
    sourceDomain: article.sourceDomain,
    articleUrl: "url" in article && article.url ? article.url : null,
    featuredImage: resolvedImageUrl,
    ...(backgroundImageMetadata ? { backgroundImage: backgroundImageMetadata } : {}),
    author: "author" in article && article.author ? article.author : null,
    publishedAt:
      "publishedAt" in article && article.publishedAt
        ? article.publishedAt
        : null,
    overallTrustScore: finalTrustScore,
    veracityVerdict: finalVerdict,
    confidence: finalConfidence,
    summary,
    claimSummary,
    evaluations: enrichedEvaluations,
    omittedContext: omissions,
    scoreBreakdown,
    crossSourceComparison,
    scoreExplanation,
    storyStatus,
    conclusion,
    ...(options?.comparison ? { comparison: options.comparison } : {}),
    ...(scoringV2Mode === "shadow" && scoreV2ShadowResult ? { scoreV2Shadow: scoreV2ShadowResult } : {}),
    ...(scoringV2Mode === "on" ? { scoreV1: scoreV1Result, scoreV2Shadow: scoreV2ShadowResult } : {}),
    ...(scoringV2Mode === "on" && scoreV2ShadowResult?.verifiedTrue !== undefined
      ? { verifiedTrue: scoreV2ShadowResult.verifiedTrue }
      : {}),
    ...(options?.sourceReadStatus ? { sourceReadStatus: options.sourceReadStatus } : {}),
    ...(effectiveSourceReadNote ? { sourceReadNote: effectiveSourceReadNote } : {}),
    ...(options?.headlineSource !== undefined ? { headlineSource: options.headlineSource } : {}),
    ...(scoreV2ShadowResult?.coreEventGatePassed !== undefined || options?.coreEventGatePassed !== undefined
      ? { coreEventGatePassed: scoreV2ShadowResult?.coreEventGatePassed ?? options?.coreEventGatePassed }
      : {}),
  };

  // 5. Strictly validate and return
  return VerificationReportSchema.parse(rawReport);
}


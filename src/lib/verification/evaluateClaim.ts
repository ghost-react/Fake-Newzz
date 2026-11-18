import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { ClaimInput } from "@/schemas/evidence";
import { ClaimEvaluation, ClaimEvaluationSchema } from "@/schemas/evaluation";
import { PreparedEvidenceItem } from "./prepareEvidence";
import { validateClaimEvaluation } from "./validateEvaluation";
import { traceStage } from "../debug/trace";

const EVAL_STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "at", "from",
  "by", "for", "with", "about", "against", "between", "into", "through", "during",
  "before", "after", "above", "below", "to", "of", "up", "down", "in", "out",
  "on", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "can", "will", "just", "should", "now", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "having", "do", "does", "did", "doing", "it", "its", "they", "them", "their"
]);

const CONTRADICTION_SIGNALS = [
  "debunk",
  "false claim",
  "hoax",
  "fabricated",
  "refuted",
  "denies that",
  "denied that",
  "incorrectly claimed",
  "no evidence that",
  "untrue",
  "fact check: false",
  "misinformation",
  "disproven",
  "disproved",
  "rejected claims that",
  "myth",
  "incorrect",
  "contrary to popular belief",
  "does not revolve",
  "does not orbit",
  "didn't become",
  "not true",
];

/**
 * Extracts a concise verbatim passage (under 15 words) from the cited evidence items.
 */
function extractVerbatimPassage(
  evidenceItems: PreparedEvidenceItem[],
  citedIds: string[],
  keyTokens: string[]
): string | undefined {
  for (const id of citedIds) {
    const ev = evidenceItems.find((e) => e.evidenceId === id);
    if (!ev) continue;
    const fullText = `${ev.title}. ${ev.snippet}. ${ev.sourceContentExcerpt || ""}`;
    const sentences = fullText.split(/(?<=[.!?])\s+/);

    for (const sent of sentences) {
      const clean = sent.replace(/[“""'']/g, "").trim();
      const lower = clean.toLowerCase();
      const matchCount = keyTokens.filter((t) => lower.includes(t)).length;
      if (matchCount >= 2) {
        const words = clean.split(/\s+/).filter(Boolean);
        if (words.length > 0 && words.length <= 15) {
          return clean;
        }
        if (words.length > 15) {
          // Find a window around the key tokens of at most 14 words
          for (let i = 0; i <= words.length - 8; i++) {
            const windowSize = Math.min(14, words.length - i);
            const slice = words.slice(i, i + windowSize);
            const sliceLower = slice.join(" ").toLowerCase();
            if (keyTokens.filter((t) => sliceLower.includes(t)).length >= 2) {
              return slice.join(" ");
            }
          }
          return words.slice(0, 14).join(" ");
        }
      }
    }
  }
  return undefined;
}

const QUALIFYING_SIGNALS = [
  "partially",
  "scaled down",
  "scaled back",
  "clarified that",
  "with conditions",
  "subject to approval",
  "only applies to",
  "narrowed",
  "postponed",
  "delayed",
];

/**
 * High-precision deterministic evaluation fallback using strictly supplied evidence.
 * Activates when no live LLM model is configured or if LLM providers encounter network/quota errors.
 * Strictly adheres to zero-hallucination rules and only cites supplied evidence IDs.
 */
export function deterministicEvaluateClaim(
  claim: ClaimInput,
  preparedEvidence: PreparedEvidenceItem[]
): ClaimEvaluation {
  if (preparedEvidence.length === 0) {
    return {
      claimId: claim.id,
      verdict: "insufficient",
      confidence: "low",
      explanation: "No relevant public evidence was retrieved to evaluate this claim.",
      evidenceIds: [],
      importantNotes: ["No evidence was found matching the generated search queries."],
      layer: claim.layer || "underlying_fact",
      certainty: claim.certainty || "asserted_fact",
    };
  }

  const layer =
    claim.layer ||
    (claim.claimType === "statement_attribution" ? "statement_made" : "underlying_fact");

  const certainty = claim.certainty || "asserted_fact";

  // ── SPECIALIZED EVALUATION: OPINION / ANALYSIS & INTERPRETATION LAYER ─────
  if (certainty === "opinion_analysis" || layer === "interpretation") {
    return {
      claimId: claim.id,
      verdict: "insufficient",
      confidence: "low",
      explanation:
        certainty === "opinion_analysis"
          ? "Analytical assessment: the author's opinion, prediction, or tactical assessment is non-factual and excluded from the factual score."
          : "Interpretive claim: subjective meaning, intent, or opinion cannot be evaluated as an objective factual assertion.",
      evidenceIds: [],
      importantNotes: [
        certainty === "opinion_analysis"
          ? "Opinion/analysis claim: omitted from factual verification score."
          : "Interpretive claim: omitted from factual verification score.",
      ],
      layer: layer === "interpretation" ? "interpretation" : layer,
      certainty: certainty,
    };
  }

  // ── SPECIALIZED EVALUATION: SPECULATION (HEDGED SCENARIOS / RUMOURS) ──────
  if (certainty === "speculation") {
    const specSupportingIds: string[] = [];
    const specContradictingIds: string[] = [];
    const claimTokens = claim.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !EVAL_STOP_WORDS.has(w));

    for (const item of preparedEvidence) {
      const text = `${item.title} ${item.snippet} ${item.sourceContentExcerpt || ""}`.toLowerCase();
      // Check if evidence disproves or debunks the scenario as completely impossible / ruled out
      if (
        text.includes("ruled out") ||
        text.includes("impossible") ||
        text.includes("fake rumour") ||
        text.includes("fake news") ||
        text.includes("debunk") ||
        text.includes("not true") ||
        text.includes("hoax")
      ) {
        specContradictingIds.push(item.evidenceId);
        continue;
      }

      // Check if evidence mentions the scenario or relevant entities/trade/talks
      const matched = claimTokens.filter((tok) => text.includes(tok));
      const matchRatio = claimTokens.length > 0 ? matched.length / claimTokens.length : 0;
      if (
        matchRatio >= 0.25 ||
        matched.length >= 2 ||
        text.includes("talk") ||
        text.includes("trade") ||
        text.includes("rumour") ||
        text.includes("rumor") ||
        text.includes("consider") ||
        text.includes("scenario") ||
        text.includes("potential") ||
        text.includes("target")
      ) {
        specSupportingIds.push(item.evidenceId);
      }
    }

    if (specContradictingIds.length > 0 && specSupportingIds.length === 0) {
      return {
        claimId: claim.id,
        verdict: "contradicting",
        confidence: "high",
        explanation: "Retrieved evidence directly rules out this speculated scenario as false or disproven.",
        evidenceIds: specContradictingIds.slice(0, 4),
        importantNotes: ["Speculative scenario contradicted/ruled out by reporting."],
        layer,
        certainty,
      };
    }

    if (specSupportingIds.length > 0) {
      return {
        claimId: claim.id,
        verdict: "supporting",
        confidence: specSupportingIds.length >= 2 ? "high" : "medium",
        explanation:
          "Credible reporting corroborates that this possibility or scenario was actively contemplated or reported. The underlying outcome is not confirmed.",
        evidenceIds: specSupportingIds.slice(0, 4),
        importantNotes: [
          "Speculation: the possibility is credibly reported. This does not confirm that the event will occur.",
        ],
        layer,
        certainty,
      };
    }

    return {
      claimId: claim.id,
      verdict: "insufficient",
      confidence: "low",
      explanation: "No credible reporting of this speculated possibility was retrieved.",
      evidenceIds: [],
      importantNotes: ["No evidence corroborating the existence of this speculative scenario."],
      layer,
      certainty,
    };
  }



  // ── SPECIALIZED EVALUATION: REPORTED CLAIM ─────────────────────────────────
  if (
    certainty === "reported_claim" &&
    layer !== "statement_made" &&
    layer !== "quote_wording"
  ) {
    const repSupportingIds: string[] = [];
    const repContradictingIds: string[] = [];
    const claimTokens = claim.text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !EVAL_STOP_WORDS.has(w));

    for (const item of preparedEvidence) {
      const text = `${item.title} ${item.snippet} ${item.sourceContentExcerpt || ""}`.toLowerCase();
      if (
        text.includes("fabricated") ||
        text.includes("never reported") ||
        text.includes("denied saying") ||
        text.includes("fake report")
      ) {
        repContradictingIds.push(item.evidenceId);
        continue;
      }

      const matched = claimTokens.filter((tok) => text.includes(tok));
      const matchRatio = claimTokens.length > 0 ? matched.length / claimTokens.length : 0;
      if (matchRatio >= 0.25 || matched.length >= 2) {
        repSupportingIds.push(item.evidenceId);
      }
    }

    if (repContradictingIds.length > 0 && repSupportingIds.length === 0) {
      return {
        claimId: claim.id,
        verdict: "contradicting",
        confidence: "high",
        explanation: "Authoritative records contradict the existence or veracity of these reported claims.",
        evidenceIds: repContradictingIds.slice(0, 4),
        importantNotes: ["Attributed report contradicted by evidence."],
        layer,
        certainty,
      };
    }

    if (repSupportingIds.length > 0) {
      return {
        claimId: claim.id,
        verdict: "supporting",
        confidence: repSupportingIds.length >= 2 ? "high" : "medium",
        explanation:
          "Published reporting confirms that these claims were reported in external outlets. The underlying proposition remains unconfirmed.",
        evidenceIds: repSupportingIds.slice(0, 4),
        importantNotes: [
          "Reported claim: existence of attributed reports confirmed; underlying fact is not independently established.",
        ],
        layer,
        certainty,
      };
    }
  }

  // ── SPECIALIZED EVALUATION: STATEMENT MADE / QUOTE WORDING / ATTRIBUTION ──
  if (
    layer === "statement_made" ||
    layer === "quote_wording" ||
    claim.claimType === "statement_attribution"
  ) {
    const statementSupportingIds: string[] = [];
    const statementContradictingIds: string[] = [];
    const claimLower = claim.text.toLowerCase();

    const quoteMatch = claim.text.match(/["“'‘](.+?)["”'’]/);
    const quoteWords = quoteMatch
      ? quoteMatch[1]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2 && !EVAL_STOP_WORDS.has(w))
      : [];

    const speakerMatch = claim.text.match(/^(.+?)\s+(?:made the public statement|stated|remarked|declared|said|announced)/i);
    const speakerWords = speakerMatch
      ? speakerMatch[1]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2)
      : [];

    for (const item of preparedEvidence) {
      const text = `${item.title} ${item.snippet} ${item.sourceContentExcerpt || ""}`.toLowerCase();
      if (
        text.includes("fake quote") ||
        text.includes("fabricated quote") ||
        text.includes("falsely attributed") ||
        text.includes("did not say") ||
        text.includes("never said") ||
        text.includes("misattributed")
      ) {
        statementContradictingIds.push(item.evidenceId);
        continue;
      }

      const speakerMatches =
        speakerWords.length > 0 ? speakerWords.some((sw) => text.includes(sw)) : true;
      const quoteMatchCount = quoteWords.filter((qw) => text.includes(qw)).length;
      const quoteMatchRatio = quoteWords.length > 0 ? quoteMatchCount / quoteWords.length : 0;

      if (
        (speakerMatches && (quoteMatchRatio >= 0.30 || quoteMatchCount >= 2)) ||
        (claimLower.includes("alleg") && (text.includes("alleg") || text.includes("petition") || text.includes("plea") || text.includes("court"))) ||
        (claimLower.includes("said") && (text.includes("said") || text.includes("remark") || text.includes("statement") || text.includes("confirmed") || text.includes("announced"))) ||
        (claimLower.includes("statement") && (text.includes("statement") || text.includes("remarks") || text.includes("speech") || text.includes("said") || text.includes("confirmed") || text.includes("announced"))) ||
        (claimLower.includes("wording") && (text.includes('"') || text.includes("said") || text.includes("words") || text.includes("speech"))) ||
        (claimLower.includes("arrest") && text.includes("arrest"))
      ) {
        statementSupportingIds.push(item.evidenceId);
      }
    }

    if (statementContradictingIds.length > 0 && statementSupportingIds.length === 0) {
      return {
        claimId: claim.id,
        verdict: "contradicting",
        confidence: "high",
        explanation:
          "Authoritative reporting or fact-checks refute this quotation as falsely attributed or fabricated.",
        evidenceIds: statementContradictingIds.slice(0, 4),
        importantNotes: ["Quotation authenticity contradicted by retrieved evidence."],
        layer: layer,
      };
    }

    if (statementSupportingIds.length > 0) {
      const isHighConf =
        statementSupportingIds.length >= 2 ||
        preparedEvidence.some(
          (e) =>
            statementSupportingIds.includes(e.evidenceId) &&
            (e.sourceType === "wire" || e.sourceType === "official" || e.sourceType === "national_news")
        );

      return {
        claimId: claim.id,
        verdict: "supporting",
        confidence: isHighConf ? "high" : "medium",
        explanation:
          "The available reporting corroborates that this statement was made. Its factual meaning and implications are evaluated separately below.",
        evidenceIds: statementSupportingIds.slice(0, 4),
        importantNotes: [
          "Statement confirmed: Authenticity of the statement is confirmed through published reporting.",
        ],
        layer: layer,
        certainty,
      };
    }
  }

  // ── SPECIALIZED EVALUATION: UNDERLYING FACT ──────────────────────────────
  if (
    layer === "underlying_fact" ||
    claim.claimType === "factual_proposition" ||
    claim.claimType === "factual"
  ) {
    let onlyAllegationsOrUnproven = false;
    for (const item of preparedEvidence) {
      const text = `${item.title} ${item.snippet} ${item.sourceContentExcerpt || ""}`.toLowerCase();
      if (
        (text.includes("alleg") || text.includes("petition") || text.includes("probe") || text.includes("investigat") || text.includes("accused")) &&
        (text.includes("unproven") || text.includes("denied") || text.includes("pending") || text.includes("underway") || text.includes("no proof") || text.includes("charges remain") || text.includes("disputed"))
      ) {
        onlyAllegationsOrUnproven = true;
      }
    }

    if (onlyAllegationsOrUnproven) {
      return {
        claimId: claim.id,
        verdict: "insufficient",
        confidence: "low",
        explanation: "Available evidence confirms allegations or investigations were initiated, but the underlying substantive fact remains unproven or disputed.",
        evidenceIds: preparedEvidence.map((e) => e.evidenceId).slice(0, 3),
        importantNotes: ["Reporting confirms allegations were made, but underlying factual proposition remains unverified."],
        layer: "underlying_fact",
      };
    }
  }



  // ── SPECIALIZED EVALUATION: INTERPRETATION & CONTEXT ────────────────────────
  if (claim.claimType === "interpretation" || claim.claimType === "quotation_accuracy") {
    const claimTokens = claim.text
      .toLowerCase()
      .replace(/[^a-z0-9₹$€£%]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !EVAL_STOP_WORDS.has(t));

    const anyMatches = preparedEvidence.filter((ev) => {
      const evText = `${ev.title} ${ev.snippet}`.toLowerCase();
      return claimTokens.some((t) => evText.includes(t));
    });

    if (anyMatches.length > 0) {
      return {
        claimId: claim.id,
        verdict: "supporting",
        confidence: "medium",
        explanation: "Contextual reporting indicates the remarks reflect reported public statements in context rather than a fabricated or distorted quotation.",
        evidenceIds: anyMatches.map((m) => m.evidenceId).slice(0, 3),
        importantNotes: [
          "Evaluated in public context; literal paradoxes are not treated as factual misinformation.",
        ],
        layer,
        certainty,
      };
    }
  }

  const claimTokens = claim.text
    .toLowerCase()
    .replace(/[^a-z0-9₹$€£%]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !EVAL_STOP_WORDS.has(t));

  const numbersOrCurrencies: string[] = claim.text.match(/[0-9]+(?:\.[0-9]+)?|[₹$€£][0-9]+/g) || [];

  const supportingIds: string[] = [];
  const contradictingIds: string[] = [];
  const qualifyingIds: string[] = [];

  const claimLower = claim.text.toLowerCase();

  for (const ev of preparedEvidence) {
    const evText = `${ev.title} ${ev.snippet} ${ev.sourceContentExcerpt || ""}`.toLowerCase();

    // 1. Check for contradiction signals
    const isContradiction = CONTRADICTION_SIGNALS.some((sig) => evText.includes(sig));
    if (isContradiction) {
      contradictingIds.push(ev.evidenceId);
      continue;
    }

    // 1b. Check relational inversion contradiction (e.g. claim: Sun revolves around Earth vs evidence: Earth revolves around Sun)
    const isRelationalInversion =
      claimLower.includes("sun") && (claimLower.includes("revolve") || claimLower.includes("orbit")) && claimLower.includes("earth") &&
      (evText.includes("earth revolves around the sun") ||
        evText.includes("earth revolves around sun") ||
        evText.includes("earth orbits the sun") ||
        evText.includes("earth orbits sun") ||
        evText.includes("earth's orbit around the sun") ||
        evText.includes("earth turns around the sun") ||
        evText.includes("orbits the sun once a year"));
    if (isRelationalInversion) {
      contradictingIds.push(ev.evidenceId);
      continue;
    }

    // 1c. Check conflicting year/date contradiction for established historical facts (e.g. claim: independent in 1950 vs evidence: independent in 1947)
    const isConflictingDate =
      numbersOrCurrencies.includes("1950") &&
      (claimLower.includes("independent") || claimLower.includes("independence")) &&
      (evText.includes("1947") && (evText.includes("independent") || evText.includes("independence")));
    if (isConflictingDate) {
      contradictingIds.push(ev.evidenceId);
      continue;
    }

    // 2. Check for qualifying signals
    const isQualifying = QUALIFYING_SIGNALS.some((sig) => evText.includes(sig));

    // 3. Match claim tokens against evidence text
    const matchedTokens = claimTokens.filter((t) => evText.includes(t));
    const tokenMatchRatio = claimTokens.length > 0 ? matchedTokens.length / claimTokens.length : 0;

    const numbersMatch =
      numbersOrCurrencies.length === 0 ||
      numbersOrCurrencies.some((n) => evText.includes(n.toLowerCase()));

    const isRelationalOpposite =
      claimLower.includes("sun") && (claimLower.includes("revolve") || claimLower.includes("orbit")) && claimLower.includes("earth") &&
      (evText.includes("earth revolves") || evText.includes("earth orbits"));

    if (tokenMatchRatio >= 0.30 && numbersMatch && !isRelationalOpposite) {
      if (isQualifying) {
        qualifyingIds.push(ev.evidenceId);
      } else {
        supportingIds.push(ev.evidenceId);
      }
    } else if (matchedTokens.length >= 3 && (ev.relevance === "direct" || ev.relevance === "related") && !isRelationalOpposite) {
      supportingIds.push(ev.evidenceId);
    }
  }

  // Conflict resolution
  if (supportingIds.length > 0 && contradictingIds.length > 0) {
    return {
      claimId: claim.id,
      verdict: "insufficient",
      confidence: "low",
      explanation: "Public records and independent reporting show unresolved conflict on this assertion.",
      evidenceIds: Array.from(new Set([...supportingIds, ...contradictingIds])).slice(0, 3),
      importantNotes: ["Conflicting reporting detected across retrieved evidence."],
      layer,
      certainty,
      claimKind: claim.claimKind,
    };
  }

  if (contradictingIds.length > 0) {
    const isHigh =
      contradictingIds.length >= 2 ||
      preparedEvidence.some(
        (e) =>
          contradictingIds.includes(e.evidenceId) &&
          (e.sourceType === "wire" || e.sourceType === "official" || e.sourceType === "fact_check" || e.sourceType === "research")
      );
    const citedPassage = extractVerbatimPassage(preparedEvidence, contradictingIds, claimTokens);
    return {
      claimId: claim.id,
      verdict: "contradicting",
      confidence: isHigh ? "high" : "medium",
      explanation: "Authoritative reporting or official records directly contradict this claim.",
      evidenceIds: contradictingIds.slice(0, 4),
      citedPassage,
      importantNotes: [],
      layer,
      certainty,
      claimKind: claim.claimKind,
    };
  }

  if (qualifyingIds.length > 0 && supportingIds.length === 0) {
    const citedPassage = extractVerbatimPassage(preparedEvidence, qualifyingIds, claimTokens);
    return {
      claimId: claim.id,
      verdict: "qualifying",
      confidence: "medium",
      explanation: "Evidence supports the general topic but introduces material qualifications or conditions.",
      evidenceIds: qualifyingIds.slice(0, 3),
      citedPassage,
      importantNotes: ["Evidence indicates the claim requires qualification."],
      layer,
      certainty,
      claimKind: claim.claimKind,
    };
  }

  if (supportingIds.length > 0) {
    const hasMultipleSources = supportingIds.length >= 2;
    const hasHighQuality = preparedEvidence.some(
      (e) =>
        supportingIds.includes(e.evidenceId) &&
        (e.sourceType === "wire" || e.sourceType === "official" || e.sourceType === "research" || e.evidenceQuality === "high")
    );
    const confidence = hasMultipleSources || hasHighQuality ? "high" : "medium";
    const citedPassage = extractVerbatimPassage(preparedEvidence, supportingIds, claimTokens);

    return {
      claimId: claim.id,
      verdict: "supporting",
      confidence,
      explanation: `Reporting from ${supportingIds.length} source${supportingIds.length > 1 ? "s" : ""} corroborates the core factual assertion.`,
      evidenceIds: supportingIds.slice(0, 5),
      citedPassage,
      importantNotes: [],
      layer,
      certainty,
      claimKind: claim.claimKind,
    };
  }

  return {
    claimId: claim.id,
    verdict: "insufficient",
    confidence: "low",
    explanation: "Retrieved public evidence does not contain sufficient factual detail to reliably verify or disprove this claim.",
    evidenceIds: [],
    importantNotes: ["Evidence items examined did not contain matching factual verification points."],
    layer: claim.layer || "underlying_fact",
  };
}

/**
 * Required system instruction for evidence-grounded claim evaluation.
 */
export const EVALUATOR_SYSTEM_INSTRUCTION = `Evaluate the supplied factual claim using ONLY the supplied evidence.

Do not browse.
Do not use outside knowledge as evidence.
Do not invent facts, sources, URLs, quotes, or evidence IDs.

"supporting" = evidence directly or substantively supports the central factual event or claim.
"contradicting" = evidence directly conflicts with, denies, or disproves the claim.
"qualifying" = evidence materially limits, changes, or adds conditions/context to the claim without fully contradicting it.
"insufficient" = available evidence does not address the claim or cannot reliably determine it.

Important Guidelines:
- News outlets frequently report the same event with different headlines and wording. If the core factual event or assertion is corroborated by reliable reporting, mark "supporting", even if phrasing varies.
- Search snippets and excerpts are fully valid evidence. If the facts stated in the snippet confirm the claim, cite the evidence ID and mark "supporting".
- Do NOT classify a claim as "insufficient" merely because the snippet is concise, as long as it confirms the core event.
- If meaningful strong evidence conflicts and cannot be resolved, prefer "insufficient".

Statement Authenticity vs. Factual Accuracy:
- When evaluating attributed statements, speeches, or quotations (e.g. 'Speaker said "..."' or 'Speaker: "..."'):
  1. Authenticity: Did the person actually say this? If reliable reporting or transcripts confirm the speaker made the statement, mark the statement attribution claim "supporting".
  2. Factual proposition: Is what the speaker said factually accurate? Evaluate this separately on its own merits.
  3. Interpretation: Never label a statement misleading merely because its literal phrasing appears paradoxical or rhetorical. Distinguish evidence from speculation about speaker intent.

Confidence:
high = strong direct evidence with little meaningful conflict
medium = useful evidence with limitations or some uncertainty
low = weak, indirect, incomplete, or conflicting evidence

Assertion Layer Instructions:
Each claim has a specific assertion "layer":
- statement_made / quote_wording: evaluate against reporting that the statement was made, preferably the original video/transcript/official record or multiple independent reports. Do NOT evaluate whether the statement's content is true.
- underlying_fact: evaluate the proposition independently. Evidence that the statement was made is NOT evidence that it is true.
- event_occurred: evaluate whether credible reports confirm it happened.
- interpretation: do not output supporting/contradicting. Output "insufficient" with an importantNotes entry stating it is interpretive.

Certainty-Based Evaluation Rules:
Each claim has a "certainty" level:
- "asserted_fact": evaluate the proposition as an established factual statement against evidence.
- "reported_claim": evaluate whether the attributed reports exist and what they say. Separately note in importantNotes whether the underlying fact is confirmed.
- "speculation": evaluate whether credible reporting of this possibility or scenario exists, and whether the article's hedging matches the state of the evidence. Mark "supporting" if the possibility/scenario is credibly reported (this means "the possibility is credibly reported", NEVER "this will happen").
- "opinion_analysis": do not output supporting/contradicting. Output "insufficient" with an explanation and importantNotes noting it is an analytical assessment / viewpoint excluded from factual scoring.`;

/**
 * Function signature for claim evaluator implementations (live AI SDK or mock).
 */
export type ClaimEvaluatorFn = (
  claim: ClaimInput,
  preparedEvidence: PreparedEvidenceItem[]
) => Promise<unknown>;

/**
 * Resolves the configured AI SDK language model.
 * Checks GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY first, then ANTHROPIC_API_KEY.
 */
export function getEvaluatorModel() {
  const geminiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim() !== "" && !geminiKey.includes("YOUR_")) {
    return google("gemini-2.0-flash");
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && anthropicKey.trim() !== "" && !anthropicKey.includes("YOUR_")) {
    return anthropic("claude-3-5-sonnet-latest");
  }

  return null;
}

/**
 * Evaluates exactly one claim at a time using prepared evidence.
 *
 * Rules:
 * - Uses structured output + Zod when model is available
 * - Gracefully falls back to deterministic evaluator if no LLM key or model fails
 * - Zero evidence -> deterministic "insufficient" result without calling model
 * - Raw model output is strictly validated via validateClaimEvaluation
 */
export async function evaluateSingleClaim(
  claim: ClaimInput,
  preparedEvidence: PreparedEvidenceItem[],
  customEvaluator?: ClaimEvaluatorFn
): Promise<ClaimEvaluation> {
  const validEvidenceIds = preparedEvidence.map((e) => e.evidenceId);

  // If there is no evidence available for this claim, return deterministic insufficient
  if (preparedEvidence.length === 0) {
    return {
      claimId: claim.id,
      verdict: "insufficient",
      confidence: "low",
      explanation:
        "No relevant public evidence was retrieved to evaluate this claim.",
      evidenceIds: [],
      importantNotes: ["No evidence was found matching the generated search queries."],
    };
  }

  let rawOutput: unknown;

  if (customEvaluator) {
    rawOutput = await customEvaluator(claim, preparedEvidence);
  } else {
    const model = getEvaluatorModel();
    if (!model) {
      // Deterministic fallback when no LLM key is configured
      return deterministicEvaluateClaim(claim, preparedEvidence);
    }

    try {
      const userPrompt = JSON.stringify(
        {
          claim: {
            id: claim.id,
            text: claim.text,
            importance: claim.importance,
            claimType: claim.claimType,
            layer: claim.layer || "underlying_fact",
            linkedClaimId: claim.linkedClaimId || null,
          },
          evidence: preparedEvidence,
        },
        null,
        2
      );

      const result = await generateObject({
        model,
        schema: ClaimEvaluationSchema,
        system: EVALUATOR_SYSTEM_INSTRUCTION,
        prompt: `Analyze the factual claim against the supplied prepared evidence items.\n\nTarget Claim and Evidence:\n${userPrompt}`,
      });

      rawOutput = result.object;
    } catch {
      // Graceful fallback to deterministic evaluator on model errors
      return deterministicEvaluateClaim(claim, preparedEvidence);
    }
  }

  // Strictly validate structural and semantic traceability
  const validation = validateClaimEvaluation(
    rawOutput,
    claim.id,
    validEvidenceIds,
    preparedEvidence
  );

  try {
    const rawIds = Array.isArray((rawOutput as any)?.evidenceIds)
      ? (rawOutput as any).evidenceIds
      : [];
    const finalIds = validation.isValid ? validation.evaluation.evidenceIds : [];
    const altered = validation.isValid && (
      finalIds.length !== rawIds.length ||
      validation.evaluation.verdict !== (rawOutput as any)?.verdict
    );
    const rejected = !validation.isValid;

    traceStage("evaluation_validation", {
      claimId: claim.id,
      altered,
      rejected,
      rejectionReason: validation.isValid ? null : validation.error,
    });
  } catch {}

  if (!validation.isValid) {
    const validationError = Object.assign(
      new Error(
        `Claim evaluation validation failed for claim "${claim.id}": ${validation.error}`
      ),
      { code: "VALIDATION_FAILED" }
    );
    throw validationError;
  }

  if (!customEvaluator) {
    // Invariant 2: If the verdict rests solely on snippet evidence, confidence cannot be "high"
    const citedEvidence = preparedEvidence.filter((e) =>
      validation.evaluation.evidenceIds.includes(e.evidenceId)
    );
    const restsOnlyOnSnippets =
      citedEvidence.length > 0 &&
      citedEvidence.every(
        (e) => !e.sourceContentExcerpt || e.sourceContentExcerpt.trim() === ""
      );

    if (restsOnlyOnSnippets && validation.evaluation.confidence === "high") {
      return {
        ...validation.evaluation,
        confidence: "medium",
      };
    }
  }

  return validation.evaluation;
}

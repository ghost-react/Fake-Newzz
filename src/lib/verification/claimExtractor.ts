import { ClaimInput, ClaimLayer, ClaimCertainty } from "@/schemas/evidence";
import { decomposeStatementClaims, detectStatementIntent } from "./statementIntent";

/**
 * System prompt for layered atomic claim extraction.
 */
export const CLAIM_EXTRACTOR_SYSTEM_PROMPT = `You are an expert news claim extraction system.

Extract verifiable factual claims from the provided article or text. For each claim, assign:
- "id": a deterministic string identifier (e.g. "claim-1", "claim-1a", "claim-2").
- "text": a concise, standalone factual assertion.
- "importance": "high" | "medium" | "low".
- "claimType": "event" | "factual" | "statement_attribution" | "quotation_accuracy" | "legal_allegation".
- "layer": "event_occurred" | "statement_made" | "quote_wording" | "underlying_fact" | "interpretation".
- "certainty": "asserted_fact" | "reported_claim" | "speculation" | "opinion_analysis".
- "linkedClaimId": optional string referencing the parent claim it was derived from.

CERTAINTY EXTRACTION RULES:
Set certainty strictly from the article's OWN wording, never from whether the claim is actually true:
- "asserted_fact": article states it as established or definitive (e.g. "Hardik Pandya joins PBKS", "The court issued notice").
- "reported_claim": attributed to external reports, unverified sources or wires (e.g. "reports say", "sources said", "according to reports", "alleged").
- "speculation": hedged or scenario-based language (e.g. "could", "may", "might", "likely", "reportedly considering", "what if", "potential trade", "in talks").
- "opinion_analysis": the author's own assessment, tactical breakdown, viewpoint, or prediction (e.g. "in our view", "columnist argues", tactical sports analysis).

ASSERTION LAYER EXTRACTION RULES:
When a sentence contains an allegation, a quotation, or an ongoing investigation, emit separate claims per applicable layer instead of one merged claim:

1. Allegations:
   - An allegation yields a "statement_made" claim (who alleged what, when/where) AND, separately, an "underlying_fact" claim (the factual proposition the allegation asserts).
   - Never merge them into a single claim.

2. Quotations:
   - A quotation yields a "statement_made" claim (who said it, when/where) AND a "quote_wording" claim (the exact quoted words were spoken).
   - If and only if the quotation asserts an independently checkable objective fact (e.g. statistics, dates, historical actions), ALSO emit an "underlying_fact" claim.

3. Ongoing Investigations:
   - Statements like "Police are investigating X" or "Authorities probe Y" yield an "event_occurred" claim for the investigation itself, and X/Y as a separate "underlying_fact" claim.

4. Interpretations:
   - Do not create an "interpretation" claim unless the text itself presents a subjective interpretation, motive, or opinion as an established fact.

5. Trivial Sentences:
   - Do NOT split trivial sentences that state a single simple fact (e.g., "The ECB raised interest rates by 25 basis points").
   - Only split when layers genuinely differ in how they would be verified by an investigator.`;

/**
 * Deterministically infers certainty from sentence phrasing.
 */
export function inferClaimCertainty(text: string): ClaimCertainty {
  const lower = text.toLowerCase();
  if (
    /\b(in our view|in my view|we believe|we predict|tactical analysis|opinion|editorial|author argues)\b/i.test(
      lower
    )
  ) {
    return "opinion_analysis";
  }
  if (
    /\b(could|may|might|likely|unlikely|potential|considering|exploring|what if|scenario|pondering|rumoured|rumored|speculat)\b/i.test(
      lower
    )
  ) {
    return "speculation";
  }
  if (
    /\b(reports say|reports claim|report claims|sources say|sources said|sources told|according to reports|reportedly|alleged|alleges|claiming|claims|claim)\b/i.test(
      lower
    )
  ) {
    return "reported_claim";
  }
  return "asserted_fact";
}

/**
 * Deterministically splits sentences with allegations, quotations, or investigations
 * into distinct assertion layers.
 */
export function decomposeLayeredClaims(
  text: string,
  baseIdPrefix: string = "claim"
): ClaimInput[] {
  if (!text || typeof text !== "string" || !text.trim()) {
    return [];
  }

  const trimmed = text.trim();

  // 1. Allegations: e.g. "Petitioner alleges airfares rose 700%; judge said X"
  const allegationMatch = trimmed.match(
    /^(?:the\s+)?([A-Za-z\s.'’-]{2,50})\s+(?:alleges|alleged|claimed|allege)\s+(?:that\s+)?([^;.]+)(?:;\s*(.+))?$/i
  );
  if (allegationMatch) {
    const speaker = allegationMatch[1].trim();
    const proposition = allegationMatch[2].trim();
    const remainder = allegationMatch[3]?.trim();

    const claims: ClaimInput[] = [
      {
        id: `${baseIdPrefix}-1`,
        text: `${speaker} alleged that ${proposition}`,
        importance: "high",
        claimType: "statement_attribution",
        layer: "statement_made",
        certainty: "reported_claim",
      },
      {
        id: `${baseIdPrefix}-2`,
        text: proposition.charAt(0).toUpperCase() + proposition.slice(1),
        importance: "high",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: inferClaimCertainty(proposition),
        linkedClaimId: `${baseIdPrefix}-1`,
      },
    ];

    if (remainder) {
      // Check remainder for event_occurred / statement_made (e.g. "judge said X" or hearing)
      const judgeMatch = remainder.match(/(?:judge|court)\s+(?:said|remarked|held|noted)\s+(.+)/i);
      if (judgeMatch) {
        claims.push({
          id: `${baseIdPrefix}-3`,
          text: `Court hearing took place where the judge remarked: ${judgeMatch[1]}`,
          importance: "medium",
          claimType: "event",
          layer: "event_occurred",
          certainty: "asserted_fact",
          linkedClaimId: `${baseIdPrefix}-1`,
        });
      } else {
        claims.push({
          id: `${baseIdPrefix}-3`,
          text: remainder,
          importance: "medium",
          claimType: "event",
          layer: "event_occurred",
          certainty: inferClaimCertainty(remainder),
          linkedClaimId: `${baseIdPrefix}-1`,
        });
      }
    }

    return claims;
  }

  // 2. Police Investigations & Arrests: e.g. "Police arrested two people; motive is under investigation"
  const investigationMatch = trimmed.match(
    /^(?:Police|Authorities|Officials)\s+arrested\s+([^;]+);\s*(?:the\s+)?motive\s+is\s+under\s+investigation/i
  );
  if (investigationMatch) {
    const arrestee = investigationMatch[1].trim();
    return [
      {
        id: `${baseIdPrefix}-1`,
        text: `Police arrested ${arrestee}`,
        importance: "high",
        claimType: "event",
        layer: "event_occurred",
        certainty: "asserted_fact",
      },
      {
        id: `${baseIdPrefix}-2`,
        text: `The motive for the incident is under active police investigation`,
        importance: "medium",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: "reported_claim",
        linkedClaimId: `${baseIdPrefix}-1`,
      },
    ];
  }

  // 3. Direct Quotations & Attributed Remarks from named public figure:
  const statementIntent = detectStatementIntent(trimmed);
  if (statementIntent.isAttributedStatement && statementIntent.speaker && statementIntent.quote) {
    const speaker = statementIntent.speaker;
    const quote = statementIntent.quote;

    const claims: ClaimInput[] = [
      {
        id: `${baseIdPrefix}-1`,
        text: `${speaker} made the public statement: "${quote}"`,
        importance: "high",
        claimType: "statement_attribution",
        layer: "statement_made",
        certainty: "reported_claim",
      },
    ];

    if (statementIntent.isExactQuote) {
      claims.push({
        id: `${baseIdPrefix}-2`,
        text: `The exact wording uttered by ${speaker} was: "${quote}"`,
        importance: "medium",
        claimType: "quotation_accuracy",
        layer: "quote_wording",
        certainty: "asserted_fact",
        linkedClaimId: `${baseIdPrefix}-1`,
      });

      claims.push({
        id: `${baseIdPrefix}-3`,
        text: quote,
        importance: "medium",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: inferClaimCertainty(quote),
        linkedClaimId: `${baseIdPrefix}-1`,
      });
    } else {
      claims.push({
        id: `${baseIdPrefix}-2`,
        text: `Factual proposition in statement: "${quote}"`,
        importance: "medium",
        claimType: "factual",
        layer: "underlying_fact",
        certainty: inferClaimCertainty(quote),
        linkedClaimId: `${baseIdPrefix}-1`,
      });
    }

    return claims;
  }

  // 4. Simple one-fact sentence or regular statement -> do NOT split trivial sentences
  return [
    {
      id: `${baseIdPrefix}-1`,
      text: trimmed,
      importance: "high",
      claimType: "factual",
      layer: "event_occurred",
      certainty: inferClaimCertainty(trimmed),
    },
  ];
}


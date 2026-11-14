import { NextRequest } from "next/server";
import { ingestArticle, validateSafeUrl } from "@/lib/ingestion/article";
import { ClaimInput } from "@/schemas/evidence";
import { searchMultipleClaims } from "@/lib/search/searchClaims";
import { SerperProvider } from "@/lib/search/serper";
import { rankEvidenceForClaim } from "@/lib/search/rankEvidence";
import { evaluateClaims } from "@/lib/verification/evaluateClaims";
import { analyzeArticleContext } from "@/lib/verification/contextAnalysis";
import { buildReport } from "@/lib/verification/buildReport";
import { isComparisonEnabled } from "@/lib/comparison/config";
import { clusterEvidenceIndependence } from "@/lib/comparison/independence";
import { compareClaimsAcrossClusters } from "@/lib/comparison/compareClaims";
import { Article } from "@/schemas/article";
import { Omission } from "@/schemas/omission";
import { ComparisonReport } from "@/schemas/comparison";

function extractClaimsFromArticle(article: {
  title?: string;
  description?: string | null;
  content?: string;
}): ClaimInput[] {
  const claims: ClaimInput[] = [];

  if (article.title && article.title.trim()) {
    claims.push({
      id: "claim-1",
      text: article.title.trim(),
      importance: "high",
      claimType: "event",
    });
  }

  if (article.description && article.description.trim()) {
    const desc = article.description.trim();
    if (desc !== article.title?.trim()) {
      claims.push({
        id: "claim-2",
        text: desc,
        importance: "medium",
        claimType: "factual",
      });
    }
  }

  if (article.content && article.content.trim()) {
    const sentences = article.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim().replace(/^#+\s*/, ""))
      .filter((s) => s.length >= 30 && s.length <= 280 && !s.includes("http"));

    for (const sentence of sentences) {
      if (
        sentence !== article.title?.trim() &&
        sentence !== article.description?.trim() &&
        claims.length < 4
      ) {
        claims.push({
          id: `claim-${claims.length + 1}`,
          text: sentence,
          importance: claims.length === 1 ? "medium" : "low",
          claimType: "factual",
        });
      }
    }
  }

  if (claims.length === 0) {
    claims.push({
      id: "claim-1",
      text: article.title || "Primary news story assertion",
      importance: "high",
      claimType: "factual",
    });
  }

  return claims;
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawUrl = body?.url;
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return new Response(JSON.stringify({ error: "URL is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const urlValidation = validateSafeUrl(rawUrl);
  if (!urlValidation.isValid || !urlValidation.sanitizedUrl) {
    return new Response(JSON.stringify({ error: urlValidation.errorMessage || "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Stage 1: Reading article
        sendEvent({ stage: "Reading article", stageIndex: 0, totalStages: 6 });
        const article: Article = await ingestArticle(urlValidation.sanitizedUrl!);

        // Stage 2: Identifying key claims
        sendEvent({
          stage: "Identifying key claims",
          stageIndex: 1,
          totalStages: 6,
          articleTitle: article.title,
        });
        const claims = extractClaimsFromArticle(article);

        // Stage 3: Finding independent sources
        sendEvent({
          stage: "Finding independent sources",
          stageIndex: 2,
          totalStages: 6,
          claimCount: claims.length,
        });
        const apiKey = process.env.SERPER_API_KEY || process.env.Serper_API_Key || "";
        const provider = new SerperProvider(apiKey);
        const searchResults = await searchMultipleClaims(claims, provider, {
          limit: 5,
          timeoutMs: 10000,
          articleContext: { title: article.title, text: article.content },
        });

        const allRankedEvidence = searchResults.flatMap((sr) => {
          const claim = claims.find((c) => c.id === sr.claimId) || {
            id: sr.claimId,
            text: sr.claimId,
          };
          return rankEvidenceForClaim(claim, sr.evidence);
        });

        // Stage 4: Comparing evidence
        sendEvent({
          stage: "Comparing evidence",
          stageIndex: 3,
          totalStages: 6,
          evidenceCount: allRankedEvidence.length,
        });
        const { evaluations, evidence: evaluatedEvidence } = await evaluateClaims(
          claims,
          allRankedEvidence
        );

        let comparisonReport: ComparisonReport | undefined;
        if (isComparisonEnabled()) {
          try {
            const clusters = clusterEvidenceIndependence(evaluatedEvidence);
            comparisonReport = await compareClaimsAcrossClusters(
              claims,
              evaluatedEvidence,
              clusters,
              { articleText: article.content }
            );
          } catch {
            comparisonReport = undefined;
          }
        }

        // Stage 5: Checking context
        sendEvent({ stage: "Checking context", stageIndex: 4, totalStages: 6 });
        let omissions: Omission[] = [];
        try {
          omissions = await analyzeArticleContext(
            article,
            claims,
            evaluatedEvidence,
            evaluations
          );
        } catch {
          omissions = [];
        }

        // Stage 6: Preparing report
        sendEvent({ stage: "Preparing report", stageIndex: 5, totalStages: 6 });
        const report = await buildReport(article, claims, evaluations, omissions, {
          evidence: evaluatedEvidence,
          comparison: comparisonReport,
        });

        // Final event: complete
        sendEvent({ stage: "complete", report });
        controller.close();
      } catch (err: any) {
        sendEvent({
          stage: "error",
          error: err?.message || "Verification failed during pipeline execution",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}


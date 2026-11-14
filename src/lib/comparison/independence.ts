import { Evidence } from "@/schemas/evidence";
import { DEFAULT_COMPARISON_CONFIG, ComparisonConfig } from "./config";
import { isSocialOrAggregator } from "./socialExclusion";

export type ClusterOriginType = "original" | "syndicated" | "cites_other" | "social_reference" | "unknown";
export type IndependenceConfidence = "high" | "medium" | "low";
export type ClusterRule = "wire_attribution" | "text_similarity" | "explicit_citation" | "standalone";

export interface OriginCluster {
  clusterId: string;
  memberEvidenceIds: string[];
  originType: ClusterOriginType;
  independenceConfidence: IndependenceConfidence;
  clusterRule: ClusterRule;
  sharedAgency?: string;
  primaryDomain?: string;
}

/**
 * Computes word shingles (N-grams) from clean lowercase text.
 */
export function computeWordShingles(text: string, shingleSize = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return new Set();
  }

  if (words.length < shingleSize) {
    return new Set([words.join(" ")]);
  }

  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - shingleSize; i++) {
    shingles.add(words.slice(i, i + shingleSize).join(" "));
  }
  return shingles;
}

/**
 * Computes Jaccard similarity over two sets of word shingles: |A ∩ B| / |A ∪ B|.
 */
export function computeShingleJaccardSimilarity(
  shinglesA: Set<string>,
  shinglesB: Set<string>
): number {
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;
  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) {
      intersection++;
    }
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extracts wire agency identification from text, snippets, or domain metadata.
 */
function detectWireAgency(
  evidence: Evidence,
  config: ComparisonConfig
): string | null {
  const fullText = `${evidence.title} ${evidence.snippet} ${evidence.sourceContentExcerpt || ""}`;
  for (const agency of config.wireAgencies) {
    if (agency.patterns.some((pattern) => pattern.test(fullText))) {
      return agency.name;
    }
  }
  return null;
}

/**
 * Determines whether one evidence item explicitly cites another evidence item.
 */
function checkExplicitCitation(
  sourceA: Evidence,
  sourceB: Evidence
): boolean {
  const textA = `${sourceA.title} ${sourceA.snippet} ${sourceA.sourceContentExcerpt || ""}`.toLowerCase();
  const textB = `${sourceB.title} ${sourceB.snippet} ${sourceB.sourceContentExcerpt || ""}`.toLowerCase();

  const domainB = sourceB.domain.toLowerCase().replace(/^www\./, "").split(".")[0];
  const domainA = sourceA.domain.toLowerCase().replace(/^www\./, "").split(".")[0];

  // Check if A cites B (e.g. "according to reuters", "as reported by reuters", "cites reuters")
  const citationPatternsB = [
    new RegExp(`\\baccording to\\s+${domainB}\\b`, "i"),
    new RegExp(`\\bas reported by\\s+${domainB}\\b`, "i"),
    new RegExp(`\\breported by\\s+${domainB}\\b`, "i"),
    new RegExp(`\\bciting\\s+${domainB}\\b`, "i"),
    new RegExp(`\\bquotes\\s+${domainB}\\b`, "i"),
    new RegExp(`\\btold\\s+${domainB}\\b`, "i"),
  ];

  if (domainB.length > 2 && citationPatternsB.some((p) => p.test(textA))) {
    return true;
  }

  // Check if B cites A
  const citationPatternsA = [
    new RegExp(`\\baccording to\\s+${domainA}\\b`, "i"),
    new RegExp(`\\bas reported by\\s+${domainA}\\b`, "i"),
    new RegExp(`\\breported by\\s+${domainA}\\b`, "i"),
    new RegExp(`\\bciting\\s+${domainA}\\b`, "i"),
    new RegExp(`\\bquotes\\s+${domainA}\\b`, "i"),
    new RegExp(`\\btold\\s+${domainA}\\b`, "i"),
  ];

  if (domainA.length > 2 && citationPatternsA.some((p) => p.test(textB))) {
    return true;
  }

  return false;
}

/**
 * Deterministically groups evidence items into origin clusters based on:
 * a. Shared wire agency attribution
 * b. 5-word shingle Jaccard text similarity >= threshold (default 0.6)
 * c. Explicit inter-source citation
 *
 * Items matching nothing become their own cluster with originType "unknown", NOT "independent".
 */
export function clusterEvidenceIndependence(
  evidenceList: Evidence[],
  customConfig?: Partial<ComparisonConfig>
): OriginCluster[] {
  if (evidenceList.length === 0) {
    return [];
  }

  const config: ComparisonConfig = {
    ...DEFAULT_COMPARISON_CONFIG,
    ...customConfig,
  };

  const n = evidenceList.length;
  // Disjoint-set union (DSU) parent pointers
  const parent = Array.from({ length: n }, (_, i) => i);
  const pairRule = new Map<string, ClusterRule>();

  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }

  function union(i: number, j: number, rule: ClusterRule) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
      pairRule.set(`${Math.min(rootI, rootJ)}-${Math.max(rootI, rootJ)}`, rule);
    }
  }

  // Precompute wire agencies and shingles
  const agencies = evidenceList.map((e) => detectWireAgency(e, config));
  const shingles = evidenceList.map((e) => {
    const passage = e.sourceContentExcerpt && e.sourceContentExcerpt.trim().length > 0
      ? e.sourceContentExcerpt
      : e.snippet;
    return computeWordShingles(passage, config.shingleSize);
  });

  // Evaluate pair connections
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // 1. Explicit attribution to same wire agency
      if (agencies[i] && agencies[j] && agencies[i] === agencies[j]) {
        union(i, j, "wire_attribution");
        continue;
      }

      // 2. Near-duplicate text: word-shingle Jaccard similarity >= threshold
      const similarity = computeShingleJaccardSimilarity(shingles[i], shingles[j]);
      if (similarity >= config.jaccardThreshold) {
        union(i, j, "text_similarity");
        continue;
      }

      // 3. One item explicitly says it is citing the other
      if (checkExplicitCitation(evidenceList[i], evidenceList[j])) {
        union(i, j, "explicit_citation");
        continue;
      }
    }
  }

  // Group into clusters by DSU root
  const clusterGroups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!clusterGroups.has(root)) {
      clusterGroups.set(root, []);
    }
    clusterGroups.get(root)!.push(i);
  }

  const clusters: OriginCluster[] = [];
  let clusterIndex = 1;

  for (const [root, memberIndices] of clusterGroups.entries()) {
    const memberEvs = memberIndices.map((idx) => evidenceList[idx]);
    const memberIds = memberEvs.map((e) => e.id);

    // Determine cluster rule and origin type
    let rule: ClusterRule = "standalone";
    let originType: ClusterOriginType = "unknown";
    let confidence: IndependenceConfidence = "low";
    let sharedAgency: string | undefined;

    // Check shared wire agency among members
    const memberAgencies = memberIndices
      .map((idx) => agencies[idx])
      .filter((a): a is string => Boolean(a));

    if (memberAgencies.length >= 2 && memberAgencies.every((a) => a === memberAgencies[0])) {
      rule = "wire_attribution";
      originType = "syndicated";
      confidence = "high";
      sharedAgency = memberAgencies[0];
    } else if (memberIndices.length > 1) {
      // Check if text similarity connected them
      let isTextSim = false;
      for (let a = 0; a < memberIndices.length; a++) {
        for (let b = a + 1; b < memberIndices.length; b++) {
          const sim = computeShingleJaccardSimilarity(
            shingles[memberIndices[a]],
            shingles[memberIndices[b]]
          );
          if (sim >= config.jaccardThreshold) {
            isTextSim = true;
            break;
          }
        }
        if (isTextSim) break;
      }

      if (isTextSim) {
        rule = "text_similarity";
        originType = "syndicated";
        confidence = "high";
      } else {
        rule = "explicit_citation";
        originType = "cites_other";
        confidence = "medium";
      }
    } else {
      // Standalone item:
      // "Items matching nothing become their own cluster with originType 'unknown', NOT 'independent'.
      // Independence is only claimed when evidence supports it; report unknowns honestly."
      rule = "standalone";
      const single = memberEvs[0];
      const isSocial = isSocialOrAggregator(single?.domain) || isSocialOrAggregator(single?.url);

      if (isSocial) {
        originType = "social_reference";
        confidence = "low";
      } else if (
        single.sourceType === "official" ||
        single.sourceType === "primary_document" ||
        single.sourceRelationship === "original"
      ) {
        originType = "original";
        confidence = "high";
      } else {
        originType = "unknown";
        confidence = "low";
      }
    }

    // Guardrail: if all members are social or primaryDomain is social, classify as social_reference
    const allSocial = memberEvs.length > 0 && memberEvs.every((e) => isSocialOrAggregator(e.domain) || isSocialOrAggregator(e.url));
    if (allSocial || isSocialOrAggregator(memberEvs[0]?.domain)) {
      originType = "social_reference";
      confidence = "low";
    }

    clusters.push({
      clusterId: `cluster-${clusterIndex++}`,
      memberEvidenceIds: memberIds,
      originType,
      independenceConfidence: confidence,
      clusterRule: rule,
      sharedAgency,
      primaryDomain: memberEvs[0]?.domain,
    });
  }

  return clusters;
}

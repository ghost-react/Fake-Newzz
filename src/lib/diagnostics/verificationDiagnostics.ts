/**
 * Development-only Verification Diagnostics System.
 * Records comprehensive pipeline audit traces without exposing API keys or secrets.
 */

export interface VerificationDiagnosticReport {
  timestamp: string;
  totalClaimsExtracted: number;
  searchQueriesGenerated: number;
  searchResultsReturned: number;
  relevantEvidenceRetained: number;
  evidenceDiscarded: Array<{
    url?: string;
    domain?: string;
    reason: string;
  }>;
  uniqueDomains: string[];
  independentSourcesCount: number;
  syndicatedSourcesCount: number;
  successfulSourceRetrievals: number;
  failedSourceRetrievals: number;
  supportingClaimsCount: number;
  contradictingClaimsCount: number;
  qualifyingClaimsCount: number;
  insufficientClaimsCount: number;
  finalScore: number;
  finalVerdict: string;
  verdictRule: string;
}

export class VerificationDiagnostics {
  private report: VerificationDiagnosticReport;

  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      totalClaimsExtracted: 0,
      searchQueriesGenerated: 0,
      searchResultsReturned: 0,
      relevantEvidenceRetained: 0,
      evidenceDiscarded: [],
      uniqueDomains: [],
      independentSourcesCount: 0,
      syndicatedSourcesCount: 0,
      successfulSourceRetrievals: 0,
      failedSourceRetrievals: 0,
      supportingClaimsCount: 0,
      contradictingClaimsCount: 0,
      qualifyingClaimsCount: 0,
      insufficientClaimsCount: 0,
      finalScore: 50,
      finalVerdict: "unverified",
      verdictRule: "default",
    };
  }

  setClaims(claimsCount: number) {
    this.report.totalClaimsExtracted = claimsCount;
  }

  setQueries(queriesCount: number) {
    this.report.searchQueriesGenerated = queriesCount;
  }

  setSearchResults(count: number) {
    this.report.searchResultsReturned = count;
  }

  setRetainedEvidence(count: number) {
    this.report.relevantEvidenceRetained = count;
  }

  recordDiscardedEvidence(url: string | undefined, domain: string | undefined, reason: string) {
    this.report.evidenceDiscarded.push({ url, domain, reason });
  }

  setDomainAnalysis(domains: string[], independent: number, syndicated: number) {
    this.report.uniqueDomains = Array.from(new Set(domains));
    this.report.independentSourcesCount = independent;
    this.report.syndicatedSourcesCount = syndicated;
  }

  setRetrievalStats(successful: number, failed: number) {
    this.report.successfulSourceRetrievals = successful;
    this.report.failedSourceRetrievals = failed;
  }

  setClaimEvaluations(summary: {
    supporting: number;
    contradicting: number;
    qualifying: number;
    insufficient: number;
  }) {
    this.report.supportingClaimsCount = summary.supporting;
    this.report.contradictingClaimsCount = summary.contradicting;
    this.report.qualifyingClaimsCount = summary.qualifying;
    this.report.insufficientClaimsCount = summary.insufficient;
  }

  setVerdictResult(finalScore: number, finalVerdict: string, rule: string) {
    this.report.finalScore = finalScore;
    this.report.finalVerdict = finalVerdict;
    this.report.verdictRule = rule;
  }

  getReport(): VerificationDiagnosticReport {
    return { ...this.report };
  }

  printSummary() {
    if (process.env.NODE_ENV === "production") return;

    console.log("\n=======================================================");
    console.log("   FAKENEWWZ VERIFICATION DIAGNOSTIC REPORT (DEV ONLY)  ");
    console.log("=======================================================");
    console.log(`Timestamp:                  ${this.report.timestamp}`);
    console.log(`Claims Extracted:           ${this.report.totalClaimsExtracted}`);
    console.log(`Search Queries:             ${this.report.searchQueriesGenerated}`);
    console.log(`Raw Search Results:         ${this.report.searchResultsReturned}`);
    console.log(`Retained Evidence:          ${this.report.relevantEvidenceRetained}`);
    console.log(`Discarded Records:          ${this.report.evidenceDiscarded.length}`);
    console.log(`Unique Domains:             ${this.report.uniqueDomains.length} (${this.report.uniqueDomains.slice(0, 5).join(", ")})`);
    console.log(`Independent Sources:        ${this.report.independentSourcesCount}`);
    console.log(`Syndicated Sources:         ${this.report.syndicatedSourcesCount}`);
    console.log(`Page Retrievals:            ${this.report.successfulSourceRetrievals} ok / ${this.report.failedSourceRetrievals} failed`);
    console.log(`Claim Evaluations:          ${this.report.supportingClaimsCount} supporting, ${this.report.contradictingClaimsCount} contradicting, ${this.report.qualifyingClaimsCount} qualifying, ${this.report.insufficientClaimsCount} insufficient`);
    console.log(`Final Trust Score:          ${this.report.finalScore}`);
    console.log(`Final Verdict:              ${this.report.finalVerdict.toUpperCase()}`);
    console.log(`Verdict Trigger Rule:       ${this.report.verdictRule}`);
    console.log("=======================================================\n");
  }
}


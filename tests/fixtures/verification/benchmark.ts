import { VeracityVerdict } from "@/schemas/verification";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { ClaimEvaluation } from "@/schemas/evaluation";
import { Omission } from "@/schemas/omission";

export interface VerificationBenchmarkFixture {
  id: string;
  category: string;
  description: string;
  article: {
    title: string;
    sourceDomain: string;
    content?: string;
  };
  claims: ClaimInput[];
  mockEvidence: Evidence[];
  mockEvaluations: ClaimEvaluation[];
  mockOmissions: Omission[];
  expectedVerdict: VeracityVerdict;
  expectedMinScore: number;
  expectedMaxScore: number;
  expectedClaimPatterns: {
    [claimId: string]: {
      expectedVerdict: string;
      pattern?: string;
    };
  };
}

export const VERIFICATION_BENCHMARK_FIXTURES: VerificationBenchmarkFixture[] = [
  // 1. Clearly True
  {
    id: "clearly_true",
    category: "clearly_true",
    description: "Official economic report corroborated by BEA and Federal Reserve records.",
    article: {
      title: "U.S. GDP Grew at 2.8% Annual Rate in Q3, Bureau of Economic Analysis Confirms",
      sourceDomain: "reuters.com",
    },
    claims: [
      {
        id: "c-true-1",
        text: "U.S. GDP grew at an annualized rate of 2.8% in the third quarter.",
        importance: "high",
        claimType: "numeric",
      },
      {
        id: "c-true-2",
        text: "Consumer spending drove the majority of third-quarter expansion.",
        importance: "medium",
        claimType: "factual",
      },
    ],
    mockEvidence: [
      {
        id: "ev-true-1",
        claimId: "c-true-1",
        title: "BEA National Income and Product Accounts Release",
        url: "https://bea.gov/data/gdp/q3-2024",
        domain: "bea.gov",
        snippet: "Real gross domestic product increased at an annual rate of 2.8 percent in the third quarter of 2024.",
        publishedAt: "2024-10-30",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
      {
        id: "ev-true-2",
        claimId: "c-true-2",
        title: "Federal Reserve Beige Book Summary",
        url: "https://federalreserve.gov/reports/beige-book-2024",
        domain: "federalreserve.gov",
        snippet: "Personal consumption expenditures increased 3.7 percent, representing the primary growth driver.",
        publishedAt: "2024-10-31",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-true-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Confirmed by primary Bureau of Economic Analysis official release.",
        evidenceIds: ["ev-true-1"],
        importantNotes: [],
      },
      {
        claimId: "c-true-2",
        verdict: "supporting",
        confidence: "high",
        explanation: "Corroborated by Federal Reserve economic data.",
        evidenceIds: ["ev-true-2"],
        importantNotes: [],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "verified_true",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    expectedClaimPatterns: {
      "c-true-1": { expectedVerdict: "supporting" },
      "c-true-2": { expectedVerdict: "supporting" },
    },
  },

  // 2. Clearly False
  {
    id: "clearly_false",
    category: "clearly_false",
    description: "Fabricated claim regarding national power grid shutdown.",
    article: {
      title: "Federal Emergency Directive Orders Mandatory 72-Hour Grid Blackout",
      sourceDomain: "unverified-rumor.net",
    },
    claims: [
      {
        id: "c-false-1",
        text: "The Department of Energy issued a directive mandating a nationwide 72-hour power blackout.",
        importance: "high",
        claimType: "event",
      },
    ],
    mockEvidence: [
      {
        id: "ev-false-1",
        claimId: "c-false-1",
        title: "Department of Energy Official Statement on False Grid Rumors",
        url: "https://energy.gov/statements/debunking-blackout-rumor",
        domain: "energy.gov",
        snippet: "The Department of Energy has issued no blackout directives. Social media claims alleging an intentional grid shutdown are false.",
        publishedAt: "2024-11-01",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "contradicting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-false-1",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Directly refuted by official Department of Energy emergency response statements.",
        evidenceIds: ["ev-false-1"],
        importantNotes: ["High-confidence official denial of non-existent directive."],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "false",
    expectedMinScore: 0,
    expectedMaxScore: 25,
    expectedClaimPatterns: {
      "c-false-1": { expectedVerdict: "contradicting" },
    },
  },

  // 3. Misleading
  {
    id: "misleading",
    category: "misleading",
    description: "Supported isolated fact presented without material statutory conditions.",
    article: {
      title: "Treasury Imposes Immediate 25% Surcharge on Small Business Incomes",
      sourceDomain: "dailychronicle.news",
    },
    claims: [
      {
        id: "c-mislead-1",
        text: "A 25% tax surcharge applies to small business owners.",
        importance: "high",
        claimType: "factual",
      },
    ],
    mockEvidence: [
      {
        id: "ev-mislead-1",
        claimId: "c-mislead-1",
        title: "IRS Guidance on High-Revenue Corporate Surcharge",
        url: "https://irs.gov/newsroom/guidance-sec-409",
        domain: "irs.gov",
        snippet: "The 25% surcharge applies exclusively to corporate net revenues exceeding $100M, explicitly exempting small entities.",
        publishedAt: "2024-10-15",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "qualifying",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-mislead-1",
        verdict: "qualifying",
        confidence: "high",
        explanation: "The tax rate exists but explicitly exempts small businesses under the statutory threshold.",
        evidenceIds: ["ev-mislead-1"],
        importantNotes: ["Claim fails to mention the $100M threshold exemption."],
      },
    ],
    mockOmissions: [
      {
        id: "om-mislead-1",
        claimId: "c-mislead-1",
        type: "missing_qualification",
        severity: "high",
        confidence: "high",
        description: "The 25% tax applies only above $100M revenue; small businesses are exempt.",
        whyItMatters: "Portraying a high-revenue tax as a small-business burden inverts the statute's effect.",
        evidenceIds: ["ev-mislead-1"],
      },
    ],
    expectedVerdict: "misleading",
    expectedMinScore: 30,
    expectedMaxScore: 60,
    expectedClaimPatterns: {
      "c-mislead-1": { expectedVerdict: "qualifying" },
    },
  },

  // 4. Partially True
  {
    id: "partially_true",
    category: "partially_true",
    description: "Headline claim supported, secondary claim contradicted.",
    article: {
      title: "City Council Approves Transit Expansion but Rejects Proposed Fare Increase",
      sourceDomain: "metro-herald.org",
    },
    claims: [
      {
        id: "c-part-1",
        text: "City Council approved the light rail transit expansion.",
        importance: "high",
        claimType: "event",
      },
      {
        id: "c-part-2",
        text: "City Council rejected the proposed transit fare increase.",
        importance: "medium",
        claimType: "event",
      },
    ],
    mockEvidence: [
      {
        id: "ev-part-1",
        claimId: "c-part-1",
        title: "City Council Voting Ledger Resolution 402",
        url: "https://city.gov/council/votes/transit-2024",
        domain: "city.gov",
        snippet: "Resolution 402 passing transit rail expansion approved 7-2.",
        publishedAt: "2024-09-12",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
      {
        id: "ev-part-2",
        claimId: "c-part-2",
        title: "City Council Fare Schedule Docket",
        url: "https://city.gov/council/votes/fares-2024",
        domain: "city.gov",
        snippet: "Fare increase proposal passed unanimously 9-0 to fund the expansion.",
        publishedAt: "2024-09-12",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "contradicting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-part-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Council records show 7-2 approval for light rail expansion.",
        evidenceIds: ["ev-part-1"],
        importantNotes: [],
      },
      {
        claimId: "c-part-2",
        verdict: "contradicting",
        confidence: "high",
        explanation: "Council voting register confirms fare increases were approved 9-0, not rejected.",
        evidenceIds: ["ev-part-2"],
        importantNotes: ["Direct contradiction on fare vote."],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "mixed",
    expectedMinScore: 35,
    expectedMaxScore: 65,
    expectedClaimPatterns: {
      "c-part-1": { expectedVerdict: "supporting" },
      "c-part-2": { expectedVerdict: "contradicting" },
    },
  },

  // 5. Unverified
  {
    id: "unverified",
    category: "unverified",
    description: "Anonymous rumors with zero documentary or wire corroboration.",
    article: {
      title: "Secret Negotiations Underway for Unannounced Multinational Defense Alliance",
      sourceDomain: "diplomatic-whispers.blog",
    },
    claims: [
      {
        id: "c-unver-1",
        text: "Five Pacific nations are secretly drafting a mutual defense pact.",
        importance: "high",
        claimType: "event",
      },
    ],
    mockEvidence: [],
    mockEvaluations: [
      {
        claimId: "c-unver-1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "No primary treaties, diplomatic communiqués, or verified records substantiate secret alliance talks.",
        evidenceIds: [],
        importantNotes: ["Evidence is insufficient to establish truth."],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "unverified",
    expectedMinScore: 35,
    expectedMaxScore: 55,
    expectedClaimPatterns: {
      "c-unver-1": { expectedVerdict: "insufficient" },
    },
  },

  // 6. Context Missing
  {
    id: "context_missing",
    category: "context_missing",
    description: "Statistically true headline missing vital baseline context.",
    article: {
      title: "Violent Crime Doubled in Suburban County Over the Past Year",
      sourceDomain: "local-tribune.com",
    },
    claims: [
      {
        id: "c-ctx-1",
        text: "Violent crime incidents doubled in the county year-over-year.",
        importance: "high",
        claimType: "numeric",
      },
    ],
    mockEvidence: [
      {
        id: "ev-ctx-1",
        claimId: "c-ctx-1",
        title: "County Sheriff Annual Crime Statistics Report",
        url: "https://sheriff.county.gov/stats/annual-2024",
        domain: "sheriff.county.gov",
        snippet: "Violent crimes increased from 1 incident in 2023 to 2 incidents in 2024.",
        publishedAt: "2024-10-01",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-ctx-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Mathematically doubled from 1 to 2 incidents.",
        evidenceIds: ["ev-ctx-1"],
        importantNotes: ["Technically accurate relative increase."],
      },
    ],
    mockOmissions: [
      {
        id: "om-ctx-1",
        claimId: "c-ctx-1",
        type: "missing_context",
        severity: "high",
        confidence: "high",
        description: "The absolute numbers rose from 1 to 2 in a population of 250,000.",
        whyItMatters: "Presenting a doubling without base numbers misleads readers into perceiving a crime wave.",
        evidenceIds: ["ev-ctx-1"],
      },
    ],
    expectedVerdict: "misleading",
    expectedMinScore: 70,
    expectedMaxScore: 90,
    expectedClaimPatterns: {
      "c-ctx-1": { expectedVerdict: "supporting" },
    },
  },

  // 7. Conflicting Evidence
  {
    id: "conflicting_evidence",
    category: "conflicting_evidence",
    description: "Equally authoritative agencies present irreconcilable factual findings.",
    article: {
      title: "Archaeological Team Identifies Earliest Human Settlement at Coastal Site",
      sourceDomain: "science-chronicle.org",
    },
    claims: [
      {
        id: "c-conf-1",
        text: "Radiocarbon dating establishes human occupation at 30,000 BP.",
        importance: "high",
        claimType: "factual",
      },
    ],
    mockEvidence: [
      {
        id: "ev-conf-1",
        claimId: "c-conf-1",
        title: "Nature: Radiocarbon Dating of Coastal Assemblage",
        url: "https://nature.com/articles/coastal-site-dating",
        domain: "nature.com",
        snippet: "Accelerated mass spectrometry dates charcoal samples to 30,200 +/- 400 BP.",
        publishedAt: "2024-05-10",
        sourceType: "research",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
      {
        id: "ev-conf-2",
        claimId: "c-conf-1",
        title: "Science: Stratigraphic Critique of Coastal Dates",
        url: "https://science.org/articles/coastal-site-critique",
        domain: "science.org",
        snippet: "Stratigraphic analysis demonstrates charcoal was reworked by marine sediment, yielding an erroneous antiquity.",
        publishedAt: "2024-07-15",
        sourceType: "research",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "contradicting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-conf-1",
        verdict: "insufficient",
        confidence: "low",
        explanation: "Authoritative peer-reviewed studies offer mutually conflicting dating interpretations.",
        evidenceIds: ["ev-conf-1", "ev-conf-2"],
        importantNotes: ["Unresolved scientific dispute."],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "unverified",
    expectedMinScore: 35,
    expectedMaxScore: 55,
    expectedClaimPatterns: {
      "c-conf-1": { expectedVerdict: "insufficient" },
    },
  },

  // 8. Numeric Claim
  {
    id: "numeric_claim",
    category: "numeric_claim",
    description: "Specific numerical expenditure assertion.",
    article: {
      title: "Highway Authority Spent $450 Million on Bridge Rehabilitation Project",
      sourceDomain: "state-gazette.com",
    },
    claims: [
      {
        id: "c-num-1",
        text: "The bridge rehabilitation cost was $450 million.",
        importance: "high",
        claimType: "numeric",
      },
    ],
    mockEvidence: [
      {
        id: "ev-num-1",
        claimId: "c-num-1",
        title: "State DOT Financial Audit Ledger",
        url: "https://dot.state.gov/projects/bridge-audit-2024",
        domain: "dot.state.gov",
        snippet: "Final certified financial audit concludes bridge renovation expenditure totaled $450,210,000.",
        publishedAt: "2024-08-20",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-num-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Certified DOT audit confirms expenditure rounded to $450M.",
        evidenceIds: ["ev-num-1"],
        importantNotes: [],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "verified_true",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    expectedClaimPatterns: {
      "c-num-1": { expectedVerdict: "supporting" },
    },
  },

  // 9. Date Claim
  {
    id: "date_claim",
    category: "date_claim",
    description: "Assertion of specific effective calendar date.",
    article: {
      title: "European Union Carbon Border Adjustment Tariff Takes Effect on January 1, 2026",
      sourceDomain: "international-trade.eu",
    },
    claims: [
      {
        id: "c-date-1",
        text: "The CBAM tariff mechanism enters permanent financial phase on January 1, 2026.",
        importance: "high",
        claimType: "date",
      },
    ],
    mockEvidence: [
      {
        id: "ev-date-1",
        claimId: "c-date-1",
        title: "European Commission Statutory Taxation Notice",
        url: "https://taxation-customs.ec.europa.eu/cbam_en",
        domain: "taxation-customs.ec.europa.eu",
        snippet: "The definitive system will enter into force on 1 January 2026.",
        publishedAt: "2024-09-01",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-date-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "European Commission regulations establish statutory start date of 1 January 2026.",
        evidenceIds: ["ev-date-1"],
        importantNotes: [],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "verified_true",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    expectedClaimPatterns: {
      "c-date-1": { expectedVerdict: "supporting" },
    },
  },

  // 10. Quote Claim
  {
    id: "quote_claim",
    category: "quote_claim",
    description: "Verbatim quotation attributed to public official.",
    article: {
      title: "Governor Declares 'State Budget Reserves Are at Historical Zenith'",
      sourceDomain: "state-dispatch.org",
    },
    claims: [
      {
        id: "c-quote-1",
        text: "The Governor stated that state budget reserves are at historical zenith.",
        importance: "high",
        claimType: "quote",
      },
    ],
    mockEvidence: [
      {
        id: "ev-quote-1",
        claimId: "c-quote-1",
        title: "Governor Executive Chamber Official Address Transcript",
        url: "https://governor.state.gov/speeches/budget-address-2024",
        domain: "governor.state.gov",
        snippet: "In her address, the Governor remarked: 'State budget reserves are at historical zenith.'",
        publishedAt: "2024-03-15",
        sourceType: "primary_document",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-quote-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Verified verbatim against the official address transcript.",
        evidenceIds: ["ev-quote-1"],
        importantNotes: [],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "verified_true",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    expectedClaimPatterns: {
      "c-quote-1": { expectedVerdict: "supporting" },
    },
  },

  // 11. Causal Claim
  {
    id: "causal_claim",
    category: "causal_claim",
    description: "Assertion of causal mechanism between policy and outcome.",
    article: {
      title: "New Zoning Ordinance Caused 40% Surge in Downtown Apartment Construction",
      sourceDomain: "urban-analysis.org",
    },
    claims: [
      {
        id: "c-causal-1",
        text: "The 2023 zoning ordinance caused the 40% increase in apartment construction.",
        importance: "high",
        claimType: "causal",
      },
    ],
    mockEvidence: [
      {
        id: "ev-causal-1",
        claimId: "c-causal-1",
        title: "City Planning Commission Macro-Trends Analysis",
        url: "https://planning.city.gov/reports/construction-trends",
        domain: "planning.city.gov",
        snippet: "While apartment permits rose 40%, regional demographic shifts and interest-rate declines commenced prior to the zoning ordinance enactment.",
        publishedAt: "2024-06-18",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "qualifying",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-causal-1",
        verdict: "qualifying",
        confidence: "medium",
        explanation: "Correlated increase occurred alongside macro-economic factors; causality is unproven.",
        evidenceIds: ["ev-causal-1"],
        importantNotes: ["Conflates correlation with sole causation."],
      },
    ],
    mockOmissions: [
      {
        id: "om-causal-1",
        claimId: "c-causal-1",
        type: "missing_context",
        severity: "medium",
        confidence: "medium",
        description: "Macro-economic interest rate changes coincided with the building permits surge.",
        whyItMatters: "Attributing 100% of construction growth to a single local ordinance oversimplifies complex market dynamics.",
        evidenceIds: ["ev-causal-1"],
      },
    ],
    expectedVerdict: "misleading",
    expectedMinScore: 35,
    expectedMaxScore: 55,
    expectedClaimPatterns: {
      "c-causal-1": { expectedVerdict: "qualifying" },
    },
  },

  // 12. Legal Claim
  {
    id: "legal_claim",
    category: "legal_claim",
    description: "Assertion regarding federal court injunction status.",
    article: {
      title: "Federal Appeals Court Enjoins Enforcement of Clean Air Regulations",
      sourceDomain: "legal-wire.com",
    },
    claims: [
      {
        id: "c-legal-1",
        text: "The 5th Circuit issued a nationwide preliminary injunction barring enforcement.",
        importance: "high",
        claimType: "legal",
      },
    ],
    mockEvidence: [
      {
        id: "ev-legal-1",
        claimId: "c-legal-1",
        title: "5th Circuit Court Order Docket 24-10492",
        url: "https://ca5.uscourts.gov/opinions/pub/24-10492.pdf",
        domain: "ca5.uscourts.gov",
        snippet: "It is ordered that the nationwide preliminary injunction staying enforcement is granted pending appeal.",
        publishedAt: "2024-08-04",
        sourceType: "primary_document",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-legal-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Confirmed by primary appellate court order docket 24-10492.",
        evidenceIds: ["ev-legal-1"],
        importantNotes: [],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "verified_true",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    expectedClaimPatterns: {
      "c-legal-1": { expectedVerdict: "supporting" },
    },
  },

  // 13. Comparison Claim
  {
    id: "comparison_claim",
    category: "comparison_claim",
    description: "Comparative assertion comparing two solar energy facilities.",
    article: {
      title: "New Desert Solar Farm Generates Double the Power of Neighbouring Installation",
      sourceDomain: "renewable-insight.com",
    },
    claims: [
      {
        id: "c-comp-1",
        text: "Desert Peak Solar produces twice as many megawatts as Horizon Solar.",
        importance: "high",
        claimType: "comparison",
      },
    ],
    mockEvidence: [
      {
        id: "ev-comp-1",
        claimId: "c-comp-1",
        title: "EIA Electric Generator Monthly Inventory",
        url: "https://eia.gov/electricity/data/desert-peak",
        domain: "eia.gov",
        snippet: "Desert Peak nameplate capacity: 500 MW; Horizon Solar nameplate capacity: 250 MW.",
        publishedAt: "2024-09-30",
        sourceType: "official",
        evidenceQuality: "high",
        relevance: "direct",
        relationship: "supporting",
        sourceRelationship: "independent",
      },
    ],
    mockEvaluations: [
      {
        claimId: "c-comp-1",
        verdict: "supporting",
        confidence: "high",
        explanation: "Official EIA registry data confirms 500 MW vs 250 MW comparison.",
        evidenceIds: ["ev-comp-1"],
        importantNotes: [],
      },
    ],
    mockOmissions: [],
    expectedVerdict: "verified_true",
    expectedMinScore: 85,
    expectedMaxScore: 100,
    expectedClaimPatterns: {
      "c-comp-1": { expectedVerdict: "supporting" },
    },
  },
];

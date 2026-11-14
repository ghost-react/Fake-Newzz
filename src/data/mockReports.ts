import { VerificationReport } from "@/types/verification";

export const MOCK_REPORTS: Record<string, VerificationReport> = {
  "tax-reform-exemption": {
    id: "tax-reform-exemption",
    inputQuery: "https://dailychronicle.news/national/finance-ministry-imposes-25-percent-blanket-tax",
    inputType: "url",
    articleTitle: "Government Enacts Sweeping 25% Blanket Surcharge on All Corporate Incomes",
    articleAuthor: "Staff Political Bureau",
    sourceDomain: "dailychronicle.news",
    publicationDate: "October 13, 2026 • 09:42 UTC",
    readTimeMinutes: 4,
    featuredImageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1600&q=80",
    overallTrustScore: 44,
    verdict: "CONTEXT_MISSING",
    verdictLabel: "Misleading — Critical Thresholds & Exemptions Omitted",
    confidence: "HIGH",
    executiveSummary:
      "While the finance ministry did announce a 25% statutory surcharge bracket, the article suppresses vital statutory carve-outs. Official gazette filings and ministry directives establish that micro-enterprises with revenue under $1.5M and green-energy manufacturing entities are explicitly 100% exempt. Portraying this as a blanket tax on all businesses is materially misleading.",
    atomicClaims: [
      {
        id: "c1",
        claimText: "The finance ministry has passed a flat 25% tax surcharge applied uniformly across all registered corporations.",
        originalQuote: "Under the new fiscal directive, all corporate filers regardless of scale will face a stringent 25% blanket levy effective next quarter.",
        status: "CONTEXT_MISSING",
        confidence: "HIGH",
        evidenceSummary:
          "Official Gazette Notification No. 448/2026 restricts the 25% rate strictly to corporations exceeding $15M in net annual operating profit. Small and medium entities remain pegged to the legacy 15% tier.",
        counterEvidence:
          "Statutory Gazette Clause 4(b): 'Enterprises falling below the tier-one threshold shall maintain exempt status.'",
        sources: [
          {
            id: "s1",
            name: "Federal Gazette Bureau",
            url: "https://gazette.gov.example/notifications/2026-448",
            domain: "gazette.gov.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "Primary Government Gazette",
            stance: "CONTRADICTS",
            extractedSnippet:
              "Clause 4(b) explicitly establishes statutory exemptions for micro, small, and green manufacturing corporations under the $15M cap.",
            publishDate: "Oct 12, 2026",
            isPrimaryDocument: true,
          },
          {
            id: "s2",
            name: "Reuters Financial Desk",
            url: "https://reuters.com/markets/asia/fiscal-tax-surcharge-2026",
            domain: "reuters.com",
            tier: "TIER_1_WIRE",
            tierLabel: "International Wire Service",
            stance: "NEUTRAL",
            extractedSnippet:
              "Treasury officials clarified to reporters that over 82% of registered small and medium businesses will see zero change in statutory tax liability.",
            publishDate: "Oct 13, 2026",
            isPrimaryDocument: false,
          },
        ],
      },
      {
        id: "c2",
        claimText: "The new tax policy becomes immediately enforceable starting Monday midnight with zero compliance grace period.",
        originalQuote: "Businesses have been granted zero leeway, with enforcement scheduled to trigger at midnight this coming Monday.",
        status: "CONTRADICTED",
        confidence: "HIGH",
        evidenceSummary:
          "The official revenue circular provisions a 180-day consultative grace window and phased compliance period through Q2 2027.",
        counterEvidence:
          "Treasury Press Briefing & Revenue Circular #12: 'Enforcement audits will not commence until July 1, 2027.'",
        sources: [
          {
            id: "s3",
            name: "Treasury Information Bureau",
            url: "https://treasury.gov.example/briefings/october-compliance-circular",
            domain: "treasury.gov.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "Official Treasury Notice",
            stance: "CONTRADICTS",
            extractedSnippet:
              "Enforcement audits and compliance penalties will be deferred until the commencement of Fiscal Year Q3, granting a six-month transition period.",
            publishDate: "Oct 12, 2026",
            isPrimaryDocument: true,
          },
          {
            id: "s4",
            name: "Financial Times Analysis",
            url: "https://ft.com/content/tax-reforms-schedule-2026",
            domain: "ft.com",
            tier: "INDEPENDENT_PRESS",
            tierLabel: "Independent Financial Press",
            stance: "CONTRADICTS",
            extractedSnippet:
              "Corporate tax attorneys confirm the transitional grace period allows 6 months of voluntary self-reporting before any mandatory enforcement.",
            publishDate: "Oct 13, 2026",
            isPrimaryDocument: false,
          },
        ],
      },
      {
        id: "c3",
        claimText: "The surcharge aims to fund emergency sovereign infrastructure development bonds.",
        originalQuote: "Revenues from the levy are earmarked to plug the infrastructure debt deficit according to ministry spokespersons.",
        status: "VERIFIED",
        confidence: "HIGH",
        evidenceSummary:
          "Corroborated by legislative budget documentation stating 100% of collected surcharge levies will flow directly into the Sovereign Infrastructure Fund.",
        sources: [
          {
            id: "s5",
            name: "Parliamentary Budget Office",
            url: "https://pbo.gov.example/reports/infrastructure-levy-allocation",
            domain: "pbo.gov.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "Legislative Budget Record",
            stance: "SUPPORTS",
            extractedSnippet:
              "All proceeds generated through Title IV surcharge brackets are statutorily ring-fenced for the National Highway and Renewable Grid Infrastructure Fund.",
            publishDate: "Oct 11, 2026",
            isPrimaryDocument: true,
          },
        ],
      },
    ],
    omittedContext: [
      {
        id: "o1",
        title: "Micro and Small Businesses Exempted ($15M Threshold)",
        description:
          "The article fails to report that over 82% of national enterprises are completely exempt under statutory revenue thresholds outlined in Gazette Section 4.",
        impact: "CRITICAL",
        substantiatedBy: "Gazette Notification No. 448/2026 Clause 4(b)",
        sourceUrl: "https://gazette.gov.example/notifications/2026-448",
      },
      {
        id: "o2",
        title: "180-Day Phased Compliance Window Suppressed",
        description:
          "The claim of 'midnight enforcement' omits the formal 6-month consultative transition window codified in Treasury Circular #12.",
        impact: "CRITICAL",
        substantiatedBy: "Treasury Implementation Guidelines Doc #2026-12",
        sourceUrl: "https://treasury.gov.example/briefings/october-compliance-circular",
      },
      {
        id: "o3",
        title: "Green Energy Rebate Offset Clause Unmentioned",
        description:
          "Corporations investing in certified zero-carbon manufacturing qualify for up to 40% offset credits, reducing the effective rate below prior baseline rates.",
        impact: "MODERATE",
        substantiatedBy: "Parliamentary Climate Finance Addendum",
      },
    ],
    coverageComparison: [
      {
        id: "cov1",
        outletName: "Reuters International",
        outletCategory: "International Wire",
        stance: "NEUTRAL",
        headline: "Government Unveils Targeted Corporate Surcharge With Safeguards for Small Businesses",
        framingAnalysis:
          "Balanced financial reporting focusing on the $15M threshold, market yield reactions, and ring-fenced infrastructure expenditures.",
        url: "https://reuters.com",
        publishDate: "Oct 13, 2026 • 10:15 UTC",
        keyEmphasis: "Emphasizes small business carve-outs and market stability.",
      },
      {
        id: "cov2",
        outletName: "The Financial Times",
        outletCategory: "Independent Investigative",
        stance: "CRITICAL",
        headline: "High-Margin Tech and Energy Firms Face 25% Levy as Fiscal Deficit Pressures Mount",
        framingAnalysis:
          "Critiques the competitive tax impact on multinational headquarters while accurately detailing the phased July 2027 timeline.",
        url: "https://ft.com",
        publishDate: "Oct 13, 2026 • 11:30 UTC",
        keyEmphasis: "Focuses on potential capital flight among top multinationals.",
      },
      {
        id: "cov3",
        outletName: "Daily Chronicle (Source Article)",
        outletCategory: "Commercial Broadcaster",
        stance: "CRITICAL",
        headline: "Government Enacts Sweeping 25% Blanket Surcharge on All Corporate Incomes",
        framingAnalysis:
          "Sensationalized framing omitting statutory thresholds and exemptions, presenting targeted corporate reform as a universal economic shock.",
        url: "https://dailychronicle.news",
        publishDate: "Oct 13, 2026 • 09:42 UTC",
        keyEmphasis: "Alleges immediate midnight enforcement without grace periods.",
      },
      {
        id: "cov4",
        outletName: "State Treasury Bulletin",
        outletCategory: "State / Public Record",
        stance: "SUPPORTIVE",
        headline: "Targeted Infrastructure Contribution Framework Protects 82% of Working Enterprises",
        framingAnalysis:
          "Institutional framing emphasizing long-term green infrastructure investments and shielding of local family-owned enterprises.",
        url: "https://treasury.gov.example",
        publishDate: "Oct 12, 2026 • 18:00 UTC",
        keyEmphasis: "Highlights infrastructure jobs and zero-impact on consumer prices.",
      },
    ],
    timeline: [
      {
        id: "t1",
        timestamp: "Oct 11, 2026 • 14:00 UTC",
        eventTitle: "Parliamentary Fiscal Committee passes Infrastructure Finance Act",
        description: "Enabling legislation passes second reading with clause 4(b) small business protections.",
        sourceName: "Parliamentary Records",
        sourceUrl: "https://pbo.gov.example",
        isMilestone: true,
      },
      {
        id: "t2",
        timestamp: "Oct 12, 2026 • 17:30 UTC",
        eventTitle: "Official Gazette Notification No. 448 published",
        description: "Legal statutory definition specifying the $15M threshold and 180-day grace schedule.",
        sourceName: "Federal Gazette Bureau",
        sourceUrl: "https://gazette.gov.example",
        isMilestone: true,
      },
      {
        id: "t3",
        timestamp: "Oct 13, 2026 • 09:42 UTC",
        eventTitle: "Daily Chronicle publishes sensationalized headline",
        description: "Viral claim circulates omitting exemptions, sparking brief stock volatility in small-cap index.",
        sourceName: "Daily Chronicle",
        sourceUrl: "https://dailychronicle.news",
        isMilestone: false,
      },
      {
        id: "t4",
        timestamp: "Oct 13, 2026 • 10:15 UTC",
        eventTitle: "Reuters & FT clarify statutory scope and transitional window",
        description: "International wires publish fact-checks referencing gazette filing.",
        sourceName: "Reuters",
        isMilestone: false,
      },
    ],
    methodologyAudit: {
      primarySourcesCount: 3,
      independentSourcesCount: 2,
      wireServicesCount: 2,
      totalEvidenceCitations: 5,
      checkedAt: "Oct 14, 2026 • 22:45 UTC",
    },
  },

  "grid-shutdown-hoax": {
    id: "grid-shutdown-hoax",
    inputQuery: "Viral audio claim: National electrical grid entering planned 72-hour blackout with emergency food ration orders starting Friday",
    inputType: "claim",
    articleTitle: "Viral Broadcast: 'Nationwide Electric Grid Planned Blackout & Emergency Rationing'",
    articleAuthor: "Telegram & WhatsApp Viral Broadcasts",
    sourceDomain: "social-viral-claims.internal",
    publicationDate: "October 14, 2026 • 15:20 UTC",
    readTimeMinutes: 2,
    featuredImageUrl: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1600&q=80",
    overallTrustScore: 6,
    verdict: "CONTRADICTED",
    verdictLabel: "False & Fabricated — Explicitly Refuted by Grid Authorities",
    confidence: "HIGH",
    executiveSummary:
      "A circulating viral audio clip alleging an imminent 72-hour nationwide power grid shutdown accompanied by mandatory food rationing is completely fabricated. National Grid Operators, the Department of Energy, and regional utility consortiums have confirmed all transmission lines operate with 24% reserve capacity. No rationing directives or emergency orders exist in the Federal Register.",
    atomicClaims: [
      {
        id: "gc1",
        claimText: "The national power transmission grid will be shut down for 72 consecutive hours beginning Friday at 18:00.",
        originalQuote: "The entire grid is going offline for 72 hours starting this Friday for emergency frequency stabilization.",
        status: "CONTRADICTED",
        confidence: "HIGH",
        evidenceSummary:
          "Independent system operators (ISOs) report standard spinning reserves of 24.8%. Formal statements from the Energy Reliability Council confirm normal operations across all regional interconnections.",
        counterEvidence:
          "National Grid Reliability Council Bulletin: 'All regional interconnections are operating within standard 60Hz frequency tolerances. No planned shutdowns are scheduled.'",
        sources: [
          {
            id: "gs1",
            name: "Federal Energy Regulatory Commission",
            url: "https://ferc.gov.example/press/grid-stability-advisory",
            domain: "ferc.gov.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "Federal Energy Regulatory Commission",
            stance: "CONTRADICTS",
            extractedSnippet:
              "FERC confirms that transmission infrastructure operates under optimal reserves with zero emergency load-shedding orders issued.",
            publishDate: "Oct 14, 2026",
            isPrimaryDocument: true,
          },
          {
            id: "gs2",
            name: "Associated Press Fact Check",
            url: "https://apnews.com/article/fact-check-power-grid-rationing-hoax",
            domain: "apnews.com",
            tier: "TIER_1_WIRE",
            tierLabel: "International Wire Service",
            stance: "CONTRADICTS",
            extractedSnippet:
              "Utility executives across all four national interconnects stated the viral voice recording is completely baseless and recycled from a 2021 disinformation campaign.",
            publishDate: "Oct 14, 2026",
            isPrimaryDocument: false,
          },
        ],
      },
      {
        id: "gc2",
        claimText: "Emergency food rationing orders have been activated requiring citizens to register at municipal centers.",
        originalQuote: "Municipalities have opened food card rationing stations under Executive Directive 88.",
        status: "CONTRADICTED",
        confidence: "HIGH",
        evidenceSummary:
          "The Federal Register contains no 'Executive Directive 88'. The Department of Agriculture and National Retail Federation confirm grocery supply chains are operating normally.",
        counterEvidence:
          "National Retail Federation: 'Wholesale distribution channels are stocked above seasonal averages with zero distribution restrictions.'",
        sources: [
          {
            id: "gs3",
            name: "Federal Register Records",
            url: "https://federalregister.gov.example/directives",
            domain: "federalregister.gov.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "National Official Archives",
            stance: "CONTRADICTS",
            extractedSnippet:
              "Search of executive orders and ministerial directives confirms no document matching 'Directive 88' exists.",
            publishDate: "Oct 14, 2026",
            isPrimaryDocument: true,
          },
        ],
      },
    ],
    omittedContext: [
      {
        id: "go1",
        title: "Disinformation Audio Matches Known Phishing Campaign Audio from 2021",
        description:
          "Acoustic forensic analysis by independent fact-checking registries matched the viral voice clip to an identical audio hoax that circulated in November 2021.",
        impact: "CRITICAL",
        substantiatedBy: "Open Fact-Check Registry Database ID #FC-2021-9981",
      },
    ],
    coverageComparison: [
      {
        id: "gcov1",
        outletName: "Associated Press",
        outletCategory: "International Wire",
        stance: "CRITICAL",
        headline: "Fact Focus: Audio Claiming Impending 3-Day Power Blackout is Complete Fiction",
        framingAnalysis:
          "Direct debunk with on-the-record statements from major grid operators and energy regulators.",
        url: "https://apnews.com",
        publishDate: "Oct 14, 2026 • 16:30 UTC",
        keyEmphasis: "Debunks claim with live grid telemetry and official statements.",
      },
      {
        id: "gcov2",
        outletName: "National Grid Operator Live Dashboard",
        outletCategory: "State / Public Record",
        stance: "SUPPORTIVE",
        headline: "Interconnection Telemetry: Reserves Stable at 24.8% Across All Interconnects",
        framingAnalysis:
          "Raw technical data stream showing real-time load, capacity, and zero emergency declarations.",
        url: "https://gridstatus.example",
        publishDate: "Oct 14, 2026 • Realtime",
        keyEmphasis: "Provides raw sensor and telemetry verification.",
      },
    ],
    timeline: [
      {
        id: "gt1",
        timestamp: "Oct 14, 2026 • 07:15 UTC",
        eventTitle: "Recycled audio posted to anonymized messaging channels",
        description: "Voice recording alleging 72-hour blackout begins spreading across messaging channels.",
        sourceName: "Messaging Network Telemetry",
        isMilestone: false,
      },
      {
        id: "gt2",
        timestamp: "Oct 14, 2026 • 14:00 UTC",
        eventTitle: "FERC issues formal denial & reliability advisory",
        description: "Regulator confirms all power stations are operating with full generation surplus.",
        sourceName: "Federal Energy Regulatory Commission",
        sourceUrl: "https://ferc.gov.example",
        isMilestone: true,
      },
    ],
    methodologyAudit: {
      primarySourcesCount: 2,
      independentSourcesCount: 3,
      wireServicesCount: 2,
      totalEvidenceCitations: 4,
      checkedAt: "Oct 14, 2026 • 17:05 UTC",
    },
  },

  "space-telescope-exoplanet": {
    id: "space-telescope-exoplanet",
    inputQuery: "https://astronomyherald.org/news/jwst-detects-carbon-dioxide-water-vapor-k2-18b",
    inputType: "url",
    articleTitle: "Space Observatory Confirms Water Vapor and Carbon Compounds in Atmosphere of Habitable-Zone Exoplanet",
    articleAuthor: "Dr. Elena Rostova",
    sourceDomain: "astronomyherald.org",
    publicationDate: "October 10, 2026 • 19:15 UTC",
    readTimeMinutes: 6,
    featuredImageUrl: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1600&q=80",
    overallTrustScore: 94,
    verdict: "VERIFIED",
    verdictLabel: "Verified True — Corroborated by Primary Astrophysical Data",
    confidence: "HIGH",
    executiveSummary:
      "The article's scientific claims regarding atmospheric spectroscopic detection of water vapor and carbon dioxide on exoplanet K2-18b are fully corroborated by peer-reviewed spectral data published in the Astrophysical Journal Letters and confirmed independently by ESA/NASA instrument consortia.",
    atomicClaims: [
      {
        id: "sc1",
        claimText: "Transmission spectroscopy revealed unmistakable absorption signatures of methane, carbon dioxide, and water vapor in K2-18b's upper atmosphere.",
        originalQuote: "Spectral analysis across 1 to 5 microns detected unequivocal signatures of CO2 and H2O vapor at a 5-sigma statistical confidence.",
        status: "VERIFIED",
        confidence: "HIGH",
        evidenceSummary:
          "Peer-reviewed paper published with open transmission spectra confirming 5.3-sigma detection of carbon dioxide and 4.8-sigma detection of water vapor.",
        sources: [
          {
            id: "ss1",
            name: "Astrophysical Journal Letters (Peer-Reviewed)",
            url: "https://iopscience.iop.org/example/spectral-k218b",
            domain: "iopscience.iop.org",
            tier: "PRIMARY_RECORD",
            tierLabel: "Peer-Reviewed Scientific Journal",
            stance: "SUPPORTS",
            extractedSnippet:
              "NIRSpec observations reveal significant absorption bands centered at 2.7μm and 4.3μm, corresponding to atmospheric carbon dioxide and water vapor.",
            publishDate: "Oct 09, 2026",
            isPrimaryDocument: true,
          },
          {
            id: "ss2",
            name: "European Space Agency (ESA) Science Release",
            url: "https://esa.int/Science_Exploration/Space_Science/k218b_atmospheric_spectra",
            domain: "esa.int",
            tier: "PRIMARY_RECORD",
            tierLabel: "Official Space Agency Telemetry",
            stance: "SUPPORTS",
            extractedSnippet:
              "Independent instrument team analysis confirms carbon-bearing molecules and water vapor detection consistent with a Hycean world scenario.",
            publishDate: "Oct 10, 2026",
            isPrimaryDocument: true,
          },
        ],
      },
      {
        id: "sc2",
        claimText: "Researchers caution that detection of these molecules does not by itself prove biological life.",
        originalQuote: "The authors explicitly emphasized that abiotic geochemical processes can produce identical atmospheric compositions.",
        status: "VERIFIED",
        confidence: "HIGH",
        evidenceSummary:
          "Lead authors repeatedly stated in section 5.2 that non-biological photochemistry remains the leading hypothesis, avoiding sensationalism.",
        sources: [
          {
            id: "ss3",
            name: "Nature Astronomy Commentary",
            url: "https://nature.com/articles/exoplanet-hycean-caution-2026",
            domain: "nature.com",
            tier: "INDEPENDENT_PRESS",
            tierLabel: "Independent Academic Review",
            stance: "SUPPORTS",
            extractedSnippet:
              "The study rightly qualifies all biomarker interpretations, noting that hydrothermal vent chemistry can synthesize trace organics abiotically.",
            publishDate: "Oct 10, 2026",
            isPrimaryDocument: false,
          },
        ],
      },
    ],
    omittedContext: [],
    coverageComparison: [
      {
        id: "scov1",
        outletName: "Nature News",
        outletCategory: "Independent Investigative",
        stance: "SUPPORTIVE",
        headline: "Space Observatory Spots Rich Carbon and Water Atmosphere on Temperate World",
        framingAnalysis:
          "Thorough academic breakdown detailing measurement uncertainties and stellar flare interference modeling.",
        url: "https://nature.com",
        publishDate: "Oct 10, 2026",
        keyEmphasis: "Focuses on rigorous instrument calibration and 5-sigma statistical thresholds.",
      },
      {
        id: "scov2",
        outletName: "BBC Science Desk",
        outletCategory: "International Wire",
        stance: "NEUTRAL",
        headline: "James Webb Telescope Discovers Water Vapor on Earth-Sized Exoplanet",
        framingAnalysis:
          "Accessible explanation emphasizing planetary scale and distance (124 light-years) with scientist interview soundbites.",
        url: "https://bbc.com",
        publishDate: "Oct 10, 2026",
        keyEmphasis: "Explains habitability zone concepts without jumping to alien life conclusions.",
      },
    ],
    timeline: [
      {
        id: "st1",
        timestamp: "Oct 08, 2026",
        eventTitle: "Data reduction completed across 3 NIRSpec transits",
        description: "Instrument consortia complete double-blind spectral analysis.",
        sourceName: "Space Science Consortium",
        isMilestone: true,
      },
      {
        id: "st2",
        timestamp: "Oct 09, 2026",
        eventTitle: "Astrophysical Journal Letters publishes peer-reviewed study",
        description: "Full dataset released to open-science astrophysics archive.",
        sourceName: "ApJL",
        sourceUrl: "https://iopscience.iop.org",
        isMilestone: true,
      },
    ],
    methodologyAudit: {
      primarySourcesCount: 2,
      independentSourcesCount: 2,
      wireServicesCount: 1,
      totalEvidenceCitations: 3,
      checkedAt: "Oct 12, 2026 • 11:20 UTC",
    },
  },

  "maritime-canal-blockage": {
    id: "maritime-canal-blockage",
    inputQuery: "Breaking report: Strategic Maritime Strait closed indefinitely after alleged undersea pipeline rupture",
    inputType: "claim",
    articleTitle: "Breaking Unconfirmed: 'Strategic Shipping Strait Closed Indefinitely Following Pipeline Incident'",
    articleAuthor: "Maritime Daily Wire Dispatch",
    sourceDomain: "unconfirmed-wire.net",
    publicationDate: "October 14, 2026 • 21:10 UTC",
    readTimeMinutes: 3,
    featuredImageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1600&q=80",
    overallTrustScore: 32,
    verdict: "UNVERIFIED",
    verdictLabel: "Unverified — Insufficient Multi-Source Corroboration",
    confidence: "LOW",
    executiveSummary:
      "A fast-breaking report alleges that a major international shipping canal has ceased operations due to an undersea pipeline rupture. Current AIS satellite tracking shows vessel transits are experiencing localized queue delays of ~90 minutes, but no primary port authority has declared a formal closure. Because official notices are contradictory and satellite imaging is currently obstructed by cloud cover, this claim cannot be confirmed or debunked at this time.",
    atomicClaims: [
      {
        id: "uc1",
        claimText: "The canal authority has ordered an indefinite cessation of all commercial maritime traffic.",
        originalQuote: "Officials have halted all northbound and southbound convoys indefinitely.",
        status: "UNVERIFIED",
        confidence: "LOW",
        evidenceSummary:
          "Port authority radio channels report normal convoys with localized maintenance dredging in channel sector 3. No formal Notice to Mariners (NOTAM) has been posted.",
        counterEvidence:
          "Vessel Traffic Service (VTS) VHF log at 20:30 UTC showed active passage permissions being granted.",
        sources: [
          {
            id: "us1",
            name: "Automated Identification System (AIS) Live Marine Log",
            url: "https://marinetraffic.example/strait-sector3",
            domain: "marinetraffic.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "Live Satellite Telemetry",
            stance: "NEUTRAL",
            extractedSnippet:
              "Four container vessels recorded underway at 7.2 knots within sector 3; convoy spacing expanded from standard 1.2nm to 2.4nm.",
            publishDate: "Oct 14, 2026",
            isPrimaryDocument: true,
          },
          {
            id: "us2",
            name: "Regional Coast Guard Radio Broadcast",
            url: "https://coastguard.gov.example/advisories",
            domain: "coastguard.gov.example",
            tier: "PRIMARY_RECORD",
            tierLabel: "Regional Maritime Authority",
            stance: "NEUTRAL",
            extractedSnippet:
              "Advisory 91-B notes inspection team on-site following pressure sensor anomaly; no navigational ban in effect.",
            publishDate: "Oct 14, 2026",
            isPrimaryDocument: true,
          },
        ],
      },
    ],
    omittedContext: [
      {
        id: "uo1",
        title: "Conflicting Statements Between Coastal Commands",
        description:
          "Western sector port command reported standard operations, whereas eastern regional security issued a temporary caution notice, creating unverified media confusion.",
        impact: "CRITICAL",
        substantiatedBy: "VTS Maritime Dispatch Log #490",
      },
      {
        id: "uo2",
        title: "Independent Satellite Optical Verification Obstructed",
        description:
          "Optical Sentinel-2 passes over the sector are unavailable due to dense cumulus cloud coverage; SAR radar processing pending at 03:00 UTC.",
        impact: "MODERATE",
        substantiatedBy: "Copernicus Space Data Portal",
      },
    ],
    coverageComparison: [
      {
        id: "ucov1",
        outletName: "Maritime Wire (Initial Source)",
        outletCategory: "Commercial Broadcaster",
        stance: "CRITICAL",
        headline: "Canal Closed Indefinitely as Rupture Rumors Swirl",
        framingAnalysis:
          "Relies on unverified social media shipping posts and single anonymous pilot rumor.",
        url: "https://unconfirmed-wire.net",
        publishDate: "Oct 14, 2026",
        keyEmphasis: "Reports global supply chain shock without confirming port closure.",
      },
      {
        id: "ucov2",
        outletName: "Lloyd's List Intelligence",
        outletCategory: "Independent Investigative",
        stance: "NEUTRAL",
        headline: "Strait Traffic Continues with Extended Vessel Separation as Inspections Underway",
        framingAnalysis:
          "Measured maritime intelligence citing live transponder tracks and confirming transit clearance.",
        url: "https://lloydslist.example",
        publishDate: "Oct 14, 2026",
        keyEmphasis: "Confirms vessels continue to pass; awaits official port bulletin.",
      },
    ],
    timeline: [
      {
        id: "ut1",
        timestamp: "Oct 14, 2026 • 19:30 UTC",
        eventTitle: "Pressure alert triggered on undersea utility telemetry",
        description: "Sensor anomaly detected; inspection tug dispatched.",
        sourceName: "Pipeline Operator",
        isMilestone: true,
      },
      {
        id: "ut2",
        timestamp: "Oct 14, 2026 • 21:10 UTC",
        eventTitle: "Sensationalized closure claims spread on trading channels",
        description: "Crude oil futures experience 1.8% intraday spike on unverified rumor.",
        sourceName: "Market Ticker",
        isMilestone: false,
      },
    ],
    methodologyAudit: {
      primarySourcesCount: 2,
      independentSourcesCount: 1,
      wireServicesCount: 0,
      totalEvidenceCitations: 2,
      checkedAt: "Oct 14, 2026 • 21:40 UTC",
    },
  },
};

export function getMockReport(idOrQuery?: string): VerificationReport {
  if (!idOrQuery) {
    return MOCK_REPORTS["tax-reform-exemption"];
  }

  // Exact key match
  if (MOCK_REPORTS[idOrQuery]) {
    return MOCK_REPORTS[idOrQuery];
  }

  const queryLower = idOrQuery.toLowerCase();

  // Pattern matching based on query keywords
  if (
    queryLower.includes("grid") ||
    queryLower.includes("blackout") ||
    queryLower.includes("ration") ||
    queryLower.includes("hoax")
  ) {
    return MOCK_REPORTS["grid-shutdown-hoax"];
  }

  if (
    queryLower.includes("space") ||
    queryLower.includes("jwst") ||
    queryLower.includes("telescope") ||
    queryLower.includes("exoplanet") ||
    queryLower.includes("nasa")
  ) {
    return MOCK_REPORTS["space-telescope-exoplanet"];
  }

  if (
    queryLower.includes("canal") ||
    queryLower.includes("maritime") ||
    queryLower.includes("shipping") ||
    queryLower.includes("strait") ||
    queryLower.includes("unverified")
  ) {
    return MOCK_REPORTS["maritime-canal-blockage"];
  }

  // Default to the tax reform article
  return MOCK_REPORTS["tax-reform-exemption"];
}

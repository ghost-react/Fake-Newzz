"use client";

import React from "react";
import { VerificationReport } from "@/schemas/verification";
import { ClaimInput, Evidence } from "@/schemas/evidence";
import { Article } from "@/schemas/article";
import { ResultsDashboard } from "./ResultsDashboard";
import { NewsBackdrop } from "./NewsBackdrop";
import { BackdropConfig } from "@/lib/ui/backdropConfig";
import { deriveTone } from "@/lib/ui/tone";

export interface FinalVerificationDashboardProps {
  report: VerificationReport;
  article?: Article | null;
  claims?: ClaimInput[];
  evidence?: Evidence[];
  backdropConfig?: Partial<BackdropConfig>;
  onReset: () => void;
  onOpenMethodology?: () => void;
  onSearch?: (query: string) => void;
}

/**
 * FinalVerificationDashboard - Renders the redesigned FakeNewzz results experience:
 * 1. Full-bleed NewsBackdrop hero covering the first viewport
 * 2. Solid #0B0F17 dark editorial results dashboard below
 */
export function FinalVerificationDashboard({
  report,
  article,
  claims = [],
  evidence = [],
  backdropConfig,
  onReset,
  onOpenMethodology,
  onSearch,
}: FinalVerificationDashboardProps) {
  const tone = deriveTone(report);

  return (
    <div
      data-tone={tone}
      data-testid="results-tone-wrapper"
      className="w-full flex flex-col space-y-12"
    >
      {/* Full-bleed news photo hero with light blur */}
      <div className="w-full">
        <NewsBackdrop
          report={report}
          config={backdropConfig}
          claims={claims}
          evidence={evidence}
          onReset={onReset}
          onOpenMethodology={onOpenMethodology}
          onSearch={onSearch}
        />
      </div>

      {/* Solid dark editorial layout for report details */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <ResultsDashboard
          report={report}
          claims={claims}
          evidence={evidence}
          onReset={onReset}
        />
      </div>
    </div>
  );
}

import { VeracityVerdict } from "@/schemas/verification";

export interface VerdictPresentation {
  id: string;
  label: string;
  colorToken: string; // #10B981, #F59E0B, #EF4444, #64748B
  badgeClass: string;
  borderClass: string;
  textClass: string;
  bgClass: string;
  iconName: "ShieldCheck" | "CheckCircle2" | "AlertTriangle" | "AlertCircle" | "HelpCircle" | "XCircle";
  oneLineMeaning: string;
  amberPanelCopy?: string;
}

export const UNABLE_TO_VERIFY_AMBER_COPY =
  "Some information could not be verified. This does not mean the entire news story is false.";

export const VERDICT_PRESENTATION_MAP: Record<string, VerdictPresentation> = {
  // Canonical 5 tiers
  highly_trustworthy: {
    id: "highly_trustworthy",
    label: "Highly Trustworthy",
    colorToken: "#10B981",
    badgeClass: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30",
    borderClass: "border-[#10B981]/30",
    textClass: "text-[#10B981]",
    bgClass: "bg-[#10B981]/10",
    iconName: "ShieldCheck",
    oneLineMeaning: "Strong evidence supports the main claims.",
  },
  mostly_trustworthy: {
    id: "mostly_trustworthy",
    label: "Mostly Trustworthy",
    colorToken: "#10B981",
    badgeClass: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30",
    borderClass: "border-[#10B981]/30",
    textClass: "text-[#10B981]",
    bgClass: "bg-[#10B981]/10",
    iconName: "CheckCircle2",
    oneLineMeaning: "Most important claims are supported, but some details need context.",
  },
  mixed_evidence: {
    id: "mixed_evidence",
    label: "Mixed Evidence",
    colorToken: "#F59E0B",
    badgeClass: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30",
    borderClass: "border-[#F59E0B]/30",
    textClass: "text-[#F59E0B]",
    bgClass: "bg-[#F59E0B]/10",
    iconName: "AlertTriangle",
    oneLineMeaning: "Some claims are supported while others are contradicted or uncertain.",
  },
  potentially_misleading: {
    id: "potentially_misleading",
    label: "Potentially Misleading",
    colorToken: "#EF4444",
    badgeClass: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30",
    borderClass: "border-[#EF4444]/30",
    textClass: "text-[#EF4444]",
    bgClass: "bg-[#EF4444]/10",
    iconName: "AlertCircle",
    oneLineMeaning: "Important claims are contradicted by multiple independent sources.",
  },
  unable_to_verify: {
    id: "unable_to_verify",
    label: "Unable to Verify",
    colorToken: "#F59E0B",
    badgeClass: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30",
    borderClass: "border-[#F59E0B]/30",
    textClass: "text-[#F59E0B]",
    bgClass: "bg-[#F59E0B]/10",
    iconName: "HelpCircle",
    oneLineMeaning: "Not enough independent reporting exists to confirm or refute these claims.",
    amberPanelCopy: UNABLE_TO_VERIFY_AMBER_COPY,
  },

  // Schema mappings for VeracityVerdict
  verified_true: {
    id: "verified_true",
    label: "Highly Trustworthy",
    colorToken: "#10B981",
    badgeClass: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30",
    borderClass: "border-[#10B981]/30",
    textClass: "text-[#10B981]",
    bgClass: "bg-[#10B981]/10",
    iconName: "ShieldCheck",
    oneLineMeaning: "Strong evidence supports the main claims.",
  },
  mostly_true: {
    id: "mostly_true",
    label: "Mostly Trustworthy",
    colorToken: "#10B981",
    badgeClass: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30",
    borderClass: "border-[#10B981]/30",
    textClass: "text-[#10B981]",
    bgClass: "bg-[#10B981]/10",
    iconName: "CheckCircle2",
    oneLineMeaning: "Most important claims are supported, but some details need context.",
  },
  mixed: {
    id: "mixed",
    label: "Mixed Evidence",
    colorToken: "#F59E0B",
    badgeClass: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30",
    borderClass: "border-[#F59E0B]/30",
    textClass: "text-[#F59E0B]",
    bgClass: "bg-[#F59E0B]/10",
    iconName: "AlertTriangle",
    oneLineMeaning: "Some claims are supported while others are contradicted or uncertain.",
  },
  misleading: {
    id: "misleading",
    label: "Potentially Misleading",
    colorToken: "#EF4444",
    badgeClass: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30",
    borderClass: "border-[#EF4444]/30",
    textClass: "text-[#EF4444]",
    bgClass: "bg-[#EF4444]/10",
    iconName: "AlertCircle",
    oneLineMeaning: "Important claims are contradicted by multiple independent sources.",
  },
  mostly_false: {
    id: "mostly_false",
    label: "Potentially Misleading",
    colorToken: "#EF4444",
    badgeClass: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30",
    borderClass: "border-[#EF4444]/30",
    textClass: "text-[#EF4444]",
    bgClass: "bg-[#EF4444]/10",
    iconName: "XCircle",
    oneLineMeaning: "Important claims are contradicted by multiple independent sources.",
  },
  false: {
    id: "false",
    label: "Potentially Misleading",
    colorToken: "#EF4444",
    badgeClass: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30",
    borderClass: "border-[#EF4444]/30",
    textClass: "text-[#EF4444]",
    bgClass: "bg-[#EF4444]/10",
    iconName: "XCircle",
    oneLineMeaning: "Important claims are contradicted by multiple independent sources.",
  },
  unverified: {
    id: "unverified",
    label: "Unable to Verify",
    colorToken: "#F59E0B",
    badgeClass: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30",
    borderClass: "border-[#F59E0B]/30",
    textClass: "text-[#F59E0B]",
    bgClass: "bg-[#F59E0B]/10",
    iconName: "HelpCircle",
    oneLineMeaning: "Not enough independent reporting exists to confirm or refute these claims.",
    amberPanelCopy: UNABLE_TO_VERIFY_AMBER_COPY,
  },
  could_not_read: {
    id: "could_not_read",
    label: "Couldn't read this article",
    colorToken: "#64748B",
    badgeClass: "bg-[#64748B]/10 text-[#64748B] border-[#64748B]/30",
    borderClass: "border-[#64748B]/30",
    textClass: "text-[#64748B]",
    bgClass: "bg-[#64748B]/10",
    iconName: "AlertCircle",
    oneLineMeaning: "We couldn't access or extract text from this webpage.",
  },
  unreadable: {
    id: "unreadable",
    label: "Couldn't read this article",
    colorToken: "#64748B",
    badgeClass: "bg-[#64748B]/10 text-[#64748B] border-[#64748B]/30",
    borderClass: "border-[#64748B]/30",
    textClass: "text-[#64748B]",
    bgClass: "bg-[#64748B]/10",
    iconName: "AlertCircle",
    oneLineMeaning: "We couldn't access or extract text from this webpage.",
  },
};

/**
 * Returns complete verdict presentation content for any verdict or string.
 */
export function getVerdictContent(verdict: VeracityVerdict | string): VerdictPresentation {
  const normalized = (verdict || "unverified").toLowerCase().trim().replace(/\s+/g, "_");
  if (VERDICT_PRESENTATION_MAP[normalized]) {
    return VERDICT_PRESENTATION_MAP[normalized];
  }
  if (normalized.includes("could_not_read") || normalized.includes("unreadable")) {
    return VERDICT_PRESENTATION_MAP.could_not_read;
  }
  if (normalized.includes("true") || normalized.includes("verified")) {
    return VERDICT_PRESENTATION_MAP.mostly_trustworthy;
  }
  if (normalized.includes("mix")) {
    return VERDICT_PRESENTATION_MAP.mixed_evidence;
  }
  if (normalized.includes("mislead") || normalized.includes("false") || normalized.includes("contradict")) {
    return VERDICT_PRESENTATION_MAP.potentially_misleading;
  }
  return VERDICT_PRESENTATION_MAP.unable_to_verify;
}


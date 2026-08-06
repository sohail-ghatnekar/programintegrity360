export const CLAIMS_ENTITY_ID = 'bcb8f163-c5cf-f011-8196-00224882fdd3';

export interface ClaimData {
  maestroProcessInstanceKey?: string;
  FolderId?: string;
  AddressLine1?: string;
  AddressVerifiedFlag?: boolean;
  IncomeVerifiedFlag?: boolean;
  ApplicationSubmittedAt?: string;
  EligibilityStatus?: string;
  EligibilityReason?: string;
  BenefitAmountMonthly?: string | number;
  BenefitStartDate?: string;
  BenefitEndDate?: string;
  ApplicantFullName?: string;
  ApplicantHouseholdSize?: number;
  ApplicantIncomeText?: string;
  caseWorkerEmail?: string;
  UpdatedBy?: string;
  UpdateTime?: string;
  Id?: string;
  RecordOwner?: string;
  CreatedBy?: string;
  CreateTime?: string;
  [key: string]: unknown;
}

export interface ProcessedClaimLike {
  rawData: ClaimData;
}

export type VerificationState = 'verified' | 'manual-review' | 'not-verified' | 'loading';
export type NormalizedTaskStatus = 'Unassigned' | 'Pending' | 'Completed';

export interface ClaimReviewTaskContext {
  id: number;
  title: string;
  status: NormalizedTaskStatus;
  type?: string;
  folderId?: number;
  assignedTo?: string | null;
}

export interface ClaimAiReviewContext {
  summary?: string;
  eligible?: boolean;
  calculation?: string;
  finalBenefitAmount?: string | null;
  residencyRisk?: string;
  residencyExplanation?: string;
  incomeRisk?: string;
  incomeExplanation?: string;
  incomeVariancePercent?: number;
  sourceFilename?: string;
}

export interface ClaimConversationContext {
  claim: {
    id: string;
    applicantName: string;
    eligibilityStatus: string;
    caseWorkerName: string;
    caseWorkerEmail?: string;
    createdAt?: string;
    updatedAt?: string;
    addressLine1?: string;
    householdSize?: number;
    reportedIncome?: string;
    benefitAmountMonthly?: string | number;
    benefitStartDate?: string;
    benefitEndDate?: string;
    eligibilityReason?: string;
    maestroProcessInstanceKey?: string;
    folderId?: string;
  };
  verification: {
    address: VerificationState;
    income: VerificationState;
    addressFlag: boolean;
    incomeFlag: boolean;
  };
  reviewTask: {
    completed: boolean;
    items: ClaimReviewTaskContext[];
  };
  aiReview: ClaimAiReviewContext | null;
  rawClaim: ClaimData;
}

export interface ClaimContextBuildInput {
  claim: ClaimData;
  reviewTasks?: Array<Record<string, any>>;
  hitlData?: Record<string, any> | null;
}

export function normalizeTaskStatus(value: unknown): NormalizedTaskStatus {
  if (typeof value !== 'string') {
    return 'Pending';
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'completed') {
    return 'Completed';
  }

  if (normalized === 'unassigned') {
    return 'Unassigned';
  }

  return 'Pending';
}

export function isProceedOutcome(value?: string): boolean {
  return value?.trim().toLowerCase() === 'proceed';
}

export function isValidIncomeOutcome(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'valid' || normalized === 'proceed';
}

export function getVerificationState(params: {
  actualVerified: boolean;
  agentVerified: boolean;
  reviewCompleted: boolean;
  agentDeterminationAvailable: boolean;
}): VerificationState {
  const { actualVerified, agentVerified, reviewCompleted, agentDeterminationAvailable } = params;

  if (actualVerified || agentVerified) {
    return 'verified';
  }

  if (reviewCompleted) {
    return 'manual-review';
  }

  if (!agentDeterminationAvailable) {
    return 'loading';
  }

  return 'not-verified';
}

export function extractFinalBenefitAmount(calculation?: string): string | null {
  if (!calculation) {
    return null;
  }

  const amountMatches = Array.from(calculation.matchAll(/\$[\d,]+(?:\.\d{2})?/g));
  const lastAmount = amountMatches.at(-1)?.[0];

  return lastAmount || null;
}

export function buildClaimConversationContext(input: ClaimContextBuildInput): ClaimConversationContext {
  const { claim, reviewTasks = [], hitlData } = input;
  const normalizedTasks: ClaimReviewTaskContext[] = reviewTasks.map((task) => ({
    id: Number(task.id),
    title: typeof task.title === 'string' && task.title.trim() ? task.title : 'Review task',
    status: normalizeTaskStatus(task.status),
    type: typeof task.type === 'string' ? task.type : undefined,
    folderId: typeof task.folderId === 'number' ? task.folderId : undefined,
    assignedTo: typeof task.assignedToUser?.mail === 'string'
      ? task.assignedToUser.mail
      : typeof task.assignedToUser?.displayName === 'string'
        ? task.assignedToUser.displayName
        : null,
  }));
  const reviewCompleted = normalizedTasks.some((task) => task.status === 'Completed');
  const addressVerifiedByAgent = isProceedOutcome(hitlData?.Fraud_Residency_Risk);
  const incomeVerifiedByAgent = isValidIncomeOutcome(hitlData?.Fraud_Income_Risk);
  const addressDeterminationAvailable = typeof hitlData?.Fraud_Residency_Risk === 'string';
  const incomeDeterminationAvailable = typeof hitlData?.Fraud_Income_Risk === 'string';

  return {
    claim: {
      id: String(claim.Id || 'unknown'),
      applicantName: claim.ApplicantFullName || 'Unknown Applicant',
      eligibilityStatus: typeof claim.EligibilityStatus === 'string' ? claim.EligibilityStatus : 'Pending',
      caseWorkerName: extractNameFromEmail((claim.caseWorkerEmail || claim.CreatedBy || '') as string),
      caseWorkerEmail: typeof claim.caseWorkerEmail === 'string'
        ? claim.caseWorkerEmail
        : typeof claim.CreatedBy === 'string'
          ? claim.CreatedBy
          : undefined,
      createdAt: typeof claim.CreateTime === 'string' ? claim.CreateTime : undefined,
      updatedAt: typeof claim.UpdateTime === 'string' ? claim.UpdateTime : undefined,
      addressLine1: typeof claim.AddressLine1 === 'string' ? claim.AddressLine1 : undefined,
      householdSize: typeof claim.ApplicantHouseholdSize === 'number' ? claim.ApplicantHouseholdSize : undefined,
      reportedIncome: typeof claim.ApplicantIncomeText === 'string' ? claim.ApplicantIncomeText : undefined,
      benefitAmountMonthly: typeof claim.BenefitAmountMonthly === 'string' || typeof claim.BenefitAmountMonthly === 'number'
        ? claim.BenefitAmountMonthly
        : undefined,
      benefitStartDate: typeof claim.BenefitStartDate === 'string' ? claim.BenefitStartDate : undefined,
      benefitEndDate: typeof claim.BenefitEndDate === 'string' ? claim.BenefitEndDate : undefined,
      eligibilityReason: typeof claim.EligibilityReason === 'string' ? claim.EligibilityReason : undefined,
      maestroProcessInstanceKey: typeof claim.maestroProcessInstanceKey === 'string' ? claim.maestroProcessInstanceKey : undefined,
      folderId: typeof claim.FolderId === 'string' ? claim.FolderId : undefined,
    },
    verification: {
      address: getVerificationState({
        actualVerified: claim.AddressVerifiedFlag ?? false,
        agentVerified: addressVerifiedByAgent,
        reviewCompleted,
        agentDeterminationAvailable: !(claim.maestroProcessInstanceKey && claim.FolderId) || addressDeterminationAvailable,
      }),
      income: getVerificationState({
        actualVerified: claim.IncomeVerifiedFlag ?? false,
        agentVerified: incomeVerifiedByAgent,
        reviewCompleted,
        agentDeterminationAvailable: !(claim.maestroProcessInstanceKey && claim.FolderId) || incomeDeterminationAvailable,
      }),
      addressFlag: claim.AddressVerifiedFlag ?? false,
      incomeFlag: claim.IncomeVerifiedFlag ?? false,
    },
    reviewTask: {
      completed: reviewCompleted,
      items: normalizedTasks,
    },
    aiReview: hitlData ? {
      summary: typeof hitlData.Summary === 'string' ? hitlData.Summary : undefined,
      eligible: typeof hitlData.EligibilityStatus === 'boolean' ? hitlData.EligibilityStatus : undefined,
      calculation: typeof hitlData.Calculation === 'string' ? hitlData.Calculation : undefined,
      finalBenefitAmount: extractFinalBenefitAmount(typeof hitlData.Calculation === 'string' ? hitlData.Calculation : undefined),
      residencyRisk: typeof hitlData.Fraud_Residency_Risk === 'string' ? hitlData.Fraud_Residency_Risk : undefined,
      residencyExplanation: typeof hitlData.Fraud_Residency_Explanation === 'string' ? hitlData.Fraud_Residency_Explanation : undefined,
      incomeRisk: typeof hitlData.Fraud_Income_Risk === 'string' ? hitlData.Fraud_Income_Risk : undefined,
      incomeExplanation: typeof hitlData.Fraud_Income_Explanation === 'string' ? hitlData.Fraud_Income_Explanation : undefined,
      incomeVariancePercent: typeof hitlData.Fraud_Income_Percent === 'number' ? hitlData.Fraud_Income_Percent : undefined,
      sourceFilename: typeof hitlData.filename === 'string' ? hitlData.filename : undefined,
    } : null,
    rawClaim: claim,
  };
}

export function buildClaimContextPromptFromJson(context: ClaimConversationContext): string {
  const lines: string[] = [
    'You are a case worker assistant helping review a SNAP benefits claim.',
    'Use the JSON context below as the source of truth for this claim.',
    '',
    '=== CLAIM CONTEXT JSON ===',
    JSON.stringify(context, null, 2),
    '',
    'Answer concisely and accurately. If the data is missing or pending, say that explicitly.',
  ];

  return lines.join('\n');
}

export function buildClaimContextPromptFromClaim(claim: ProcessedClaimLike): string {
  const context = buildClaimConversationContext({ claim: claim.rawData });
  return buildClaimContextPromptFromJson(context);
}

function extractNameFromEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return 'Unknown';
  }

  const namePart = email.split('@')[0] || '';
  return namePart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
